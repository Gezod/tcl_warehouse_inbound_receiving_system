import crypto from 'crypto';
import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import {
  DocumentStatus,
  Receipt,
  ReceiptBatchResult,
  ReceivingDocument,
} from '@/src/types/domain';
import { AppError, ErrorDetail } from '../errors';

export interface RecordReceiptItem {
  lineId: string;
  receivedQty: number;
  note?: string | null;
}

export async function executeReceiptBatch(
  userId: string,
  documentId: string,
  receivedAt: string,
  items: RecordReceiptItem[],
  requestId?: string,
  client?: PoolClient
): Promise<ReceiptBatchResult> {
  const db = client || getPool();

  // 1. Lock document row FOR UPDATE (Tech Spec 9.3 step 7)
  const docQuery = `
    SELECT id, document_number, status, supplier_name, reference_number,
           expected_arrival_date, notes, created_by, created_at, updated_at,
           submitted_at, completed_at, cancelled_at
    FROM receiving_documents
    WHERE id = $1
    FOR UPDATE;
  `;
  const docResult = await db.query(docQuery, [documentId]);
  if (docResult.rows.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
  }
  const docRow = docResult.rows[0];

  // BR-05: Must be OPEN or PARTIALLY_RECEIVED
  if (docRow.status !== 'OPEN' && docRow.status !== 'PARTIALLY_RECEIVED') {
    throw new AppError(
      409,
      'INVALID_DOCUMENT_STATE',
      `Cannot record receipts against document in status ${docRow.status}. Receipts are allowed only when status is OPEN or PARTIALLY_RECEIVED.`
    );
  }

  // 2. Lock requested lines in ascending ID order FOR UPDATE (Tech Spec 9.3 step 8, NFR-02)
  const lineIds = items.map((i) => i.lineId);
  const linesQuery = `
    SELECT id, document_id, product_id, expected_qty, received_qty
    FROM receiving_lines
    WHERE id = ANY($1::uuid[]) AND document_id = $2
    ORDER BY id ASC
    FOR UPDATE;
  `;
  const linesResult = await db.query(linesQuery, [lineIds, documentId]);
  const linesMap = new Map<string, any>();
  for (const row of linesResult.rows) {
    linesMap.set(row.id, row);
  }

  // Validate every requested line belongs to this document
  const missingLineDetails: ErrorDetail[] = [];
  for (const item of items) {
    if (!linesMap.has(item.lineId)) {
      missingLineDetails.push({
        lineId: item.lineId,
        code: 'VALIDATION_ERROR',
        message: `Line ID ${item.lineId} does not belong to this receiving document.`,
      });
    }
  }
  if (missingLineDetails.length > 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'One or more lines do not belong to this receiving document.',
      'items',
      missingLineDetails
    );
  }

  // 3. Check every item against remaining quantity (BR-03, US-06)
  const overReceiptDetails: ErrorDetail[] = [];
  for (const item of items) {
    const line = linesMap.get(item.lineId);
    const remaining = line.expected_qty - line.received_qty;
    if (item.receivedQty > remaining) {
      overReceiptDetails.push({
        lineId: item.lineId,
        requested: item.receivedQty,
        remaining,
        code: 'OVER_RECEIPT',
        message: `Requested ${item.receivedQty}, remaining ${remaining}.`,
      });
    }
  }

  if (overReceiptDetails.length > 0) {
    throw new AppError(
      422,
      'OVER_RECEIPT',
      'Received quantity exceeds the remaining quantity for one or more lines.',
      undefined,
      overReceiptDetails
    );
  }

  // 4. Atomic execution: insert receipts, update lines, insert inventory_transactions
  const batchId = crypto.randomUUID();
  const createdReceipts: Receipt[] = [];
  const linesAuditData: any[] = [];

  for (const item of items) {
    const line = linesMap.get(item.lineId);

    // 4a. Insert receipt
    const receiptInsertQuery = `
      INSERT INTO receipts (
        batch_id,
        document_id,
        line_id,
        received_qty,
        note,
        received_at,
        recorded_by,
        recorded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      RETURNING id, line_id, received_qty, note, received_at, recorded_by, recorded_at;
    `;
    const receiptRes = await db.query(receiptInsertQuery, [
      batchId,
      documentId,
      item.lineId,
      item.receivedQty,
      item.note || null,
      receivedAt,
      userId,
    ]);
    const rRow = receiptRes.rows[0];

    createdReceipts.push({
      id: rRow.id,
      lineId: rRow.line_id,
      receivedQty: rRow.received_qty,
      note: rRow.note,
      receivedAt: rRow.received_at.toISOString(),
      recordedBy: rRow.recorded_by,
      recordedAt: rRow.recorded_at.toISOString(),
    });

    // 4b. Update line received_qty
    const updateLineQuery = `
      UPDATE receiving_lines
      SET received_qty = received_qty + $1, updated_at = now()
      WHERE id = $2;
    `;
    await db.query(updateLineQuery, [item.receivedQty, item.lineId]);

    // 4c. Insert inventory transaction (BR-09)
    const invTxQuery = `
      INSERT INTO inventory_transactions (
        type,
        product_id,
        quantity,
        document_id,
        line_id,
        receipt_id,
        created_by,
        created_at
      )
      VALUES ('RECEIPT', $1, $2, $3, $4, $5, $6, now());
    `;
    await db.query(invTxQuery, [
      line.product_id,
      item.receivedQty,
      documentId,
      item.lineId,
      rRow.id,
      userId,
    ]);

    linesAuditData.push({
      lineId: item.lineId,
      productId: line.product_id,
      receivedQty: item.receivedQty,
      priorReceivedQty: line.received_qty,
      newReceivedQty: line.received_qty + item.receivedQty,
    });
  }

  // 5. Automatic status transition: if OPEN, move to PARTIALLY_RECEIVED (PRD Section 7, D-02)
  let newStatus: DocumentStatus = docRow.status;
  if (docRow.status === 'OPEN') {
    newStatus = 'PARTIALLY_RECEIVED';
    await db.query(
      `UPDATE receiving_documents SET status = 'PARTIALLY_RECEIVED', updated_at = now() WHERE id = $1;`,
      [documentId]
    );
  } else {
    await db.query(
      `UPDATE receiving_documents SET updated_at = now() WHERE id = $1;`,
      [documentId]
    );
  }

  // 6. Write audit log (FR-21)
  const auditQuery = `
    INSERT INTO audit_logs (
      request_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      after_data,
      created_at
    )
    VALUES ($1, $2, 'receipt.record', 'receiving_document', $3, $4, now());
  `;
  await db.query(auditQuery, [
    requestId || null,
    userId,
    documentId,
    JSON.stringify({
      batchId,
      receivedAt,
      items: linesAuditData,
      statusTransition: docRow.status !== newStatus ? { from: docRow.status, to: newStatus } : null,
    }),
  ]);

  // 7. Fetch updated totals for document
  const totalsQuery = `
    SELECT 
      COUNT(id)::int AS line_count,
      COALESCE(SUM(expected_qty), 0)::int AS expected_qty,
      COALESCE(SUM(received_qty), 0)::int AS received_qty,
      COALESCE(SUM(expected_qty - received_qty), 0)::int AS remaining_qty
    FROM receiving_lines
    WHERE document_id = $1;
  `;
  const totalsRes = await db.query(totalsQuery, [documentId]);
  const totalsRow = totalsRes.rows[0];

  const document: ReceivingDocument = {
    id: docRow.id,
    documentNumber: docRow.document_number,
    status: newStatus,
    supplierName: docRow.supplier_name,
    referenceNumber: docRow.reference_number,
    expectedArrivalDate: docRow.expected_arrival_date
      ? typeof docRow.expected_arrival_date === 'string'
        ? docRow.expected_arrival_date
        : docRow.expected_arrival_date.toISOString().split('T')[0]
      : null,
    notes: docRow.notes,
    totals: {
      lineCount: totalsRow.line_count,
      expectedQty: totalsRow.expected_qty,
      receivedQty: totalsRow.received_qty,
      remainingQty: totalsRow.remaining_qty,
    },
    createdBy: docRow.created_by,
    createdAt: docRow.created_at.toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: docRow.submitted_at ? docRow.submitted_at.toISOString() : null,
    completedAt: docRow.completed_at ? docRow.completed_at.toISOString() : null,
    cancelledAt: docRow.cancelled_at ? docRow.cancelled_at.toISOString() : null,
  };

  return {
    documentId,
    documentStatus: newStatus,
    receipts: createdReceipts,
    document,
  };
}
