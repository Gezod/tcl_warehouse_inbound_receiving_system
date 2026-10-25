import { PoolClient } from 'pg';
import { getPool } from '../db/pool';
import {
  DocumentStatus,
  Receipt,
  ReceivingDocument,
  ReceivingDocumentDetail,
  ReceivingLine,
} from '@/src/types/domain';

export async function findReceivingDocuments(
  options: {
    status?: DocumentStatus;
    supplier?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    page: number;
    pageSize: number;
  },
  client?: PoolClient
): Promise<{ documents: ReceivingDocument[]; total: number }> {
  const db = client || getPool();
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (options.status) {
    conditions.push(`d.status = $${paramIndex}`);
    params.push(options.status);
    paramIndex++;
  }

  if (options.supplier && options.supplier.trim()) {
    conditions.push(`d.supplier_name ILIKE $${paramIndex}`);
    params.push(`%${options.supplier.trim()}%`);
    paramIndex++;
  }

  if (options.dateFrom) {
    conditions.push(`d.created_at >= $${paramIndex}::timestamptz`);
    params.push(options.dateFrom);
    paramIndex++;
  }

  if (options.dateTo) {
    conditions.push(`d.created_at < $${paramIndex}::timestamptz`);
    params.push(options.dateTo);
    paramIndex++;
  }

  if (options.q && options.q.trim()) {
    conditions.push(
      `(d.document_number ILIKE $${paramIndex} OR d.reference_number ILIKE $${paramIndex})`
    );
    params.push(`%${options.q.trim()}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Total count
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM receiving_documents d
    ${whereClause};
  `;
  const countResult = await db.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // 2. Data with totals aggregation
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize);
  const limitParam = paramIndex++;
  params.push(offset);
  const offsetParam = paramIndex++;

  const dataQuery = `
    SELECT 
      d.id,
      d.document_number,
      d.status,
      d.supplier_name,
      d.reference_number,
      d.expected_arrival_date,
      d.notes,
      d.created_by,
      d.created_at,
      d.updated_at,
      d.submitted_at,
      d.completed_at,
      d.cancelled_at,
      COUNT(l.id)::int AS line_count,
      COALESCE(SUM(l.expected_qty), 0)::int AS expected_qty,
      COALESCE(SUM(l.received_qty), 0)::int AS received_qty,
      COALESCE(SUM(l.expected_qty - l.received_qty), 0)::int AS remaining_qty
    FROM receiving_documents d
    LEFT JOIN receiving_lines l ON l.document_id = d.id
    ${whereClause}
    GROUP BY d.id
    ORDER BY d.created_at DESC
    LIMIT $${limitParam} OFFSET $${offsetParam};
  `;

  const result = await db.query(dataQuery, params);

  const documents: ReceivingDocument[] = result.rows.map((row) => ({
    id: row.id,
    documentNumber: row.document_number,
    status: row.status,
    supplierName: row.supplier_name,
    referenceNumber: row.reference_number,
    expectedArrivalDate: row.expected_arrival_date
      ? typeof row.expected_arrival_date === 'string'
        ? row.expected_arrival_date
        : row.expected_arrival_date.toISOString().split('T')[0]
      : null,
    notes: row.notes,
    totals: {
      lineCount: row.line_count,
      expectedQty: row.expected_qty,
      receivedQty: row.received_qty,
      remainingQty: row.remaining_qty,
    },
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    submittedAt: row.submitted_at ? row.submitted_at.toISOString() : null,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
  }));

  return { documents, total };
}

export async function findReceivingDocumentById(
  id: string,
  options: { forUpdate?: boolean } = {},
  client?: PoolClient
): Promise<ReceivingDocumentDetail | null> {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(id)) {
    return null;
  }

  const db = client || getPool();

  const docQuery = `
    SELECT 
      id,
      document_number,
      status,
      supplier_name,
      supplier_key,
      reference_number,
      expected_arrival_date,
      notes,
      created_by,
      created_at,
      updated_at,
      submitted_at,
      completed_at,
      cancelled_at
    FROM receiving_documents
    WHERE id = $1
    ${options.forUpdate ? 'FOR UPDATE' : ''};
  `;

  const docResult = await db.query(docQuery, [id]);
  if (docResult.rows.length === 0) {
    return null;
  }
  const docRow = docResult.rows[0];

  // Fetch lines with product details
  const linesQuery = `
    SELECT 
      l.id,
      l.document_id,
      l.expected_qty,
      l.received_qty,
      l.created_at,
      p.id AS product_id,
      p.sku AS product_sku,
      p.name AS product_name
    FROM receiving_lines l
    JOIN products p ON p.id = l.product_id
    WHERE l.document_id = $1
    ORDER BY l.created_at ASC, l.id ASC;
  `;
  const linesResult = await db.query(linesQuery, [id]);

  // Fetch receipts for this document
  const receiptsQuery = `
    SELECT 
      r.id,
      r.line_id,
      r.received_qty,
      r.note,
      r.received_at,
      r.recorded_by,
      r.recorded_at
    FROM receipts r
    WHERE r.document_id = $1
    ORDER BY r.recorded_at DESC;
  `;
  const receiptsResult = await db.query(receiptsQuery, [id]);

  const receiptsByLine: Record<string, Receipt[]> = {};
  for (const r of receiptsResult.rows) {
    if (!receiptsByLine[r.line_id]) {
      receiptsByLine[r.line_id] = [];
    }
    receiptsByLine[r.line_id].push({
      id: r.id,
      lineId: r.line_id,
      receivedQty: r.received_qty,
      note: r.note,
      receivedAt: r.received_at.toISOString(),
      recordedBy: r.recorded_by,
      recordedAt: r.recorded_at.toISOString(),
    });
  }

  let totalExpected = 0;
  let totalReceived = 0;

  const lines: ReceivingLine[] = linesResult.rows.map((row) => {
    const expected = row.expected_qty;
    const received = row.received_qty;
    const remaining = Math.max(0, expected - received);
    totalExpected += expected;
    totalReceived += received;

    return {
      id: row.id,
      documentId: row.document_id,
      product: {
        id: row.product_id,
        sku: row.product_sku,
        name: row.product_name,
      },
      expectedQty: expected,
      receivedQty: received,
      remainingQty: remaining,
      createdAt: row.created_at.toISOString(),
      receipts: receiptsByLine[row.id] || [],
    };
  });

  return {
    id: docRow.id,
    documentNumber: docRow.document_number,
    status: docRow.status,
    supplierName: docRow.supplier_name,
    referenceNumber: docRow.reference_number,
    expectedArrivalDate: docRow.expected_arrival_date
      ? typeof docRow.expected_arrival_date === 'string'
        ? docRow.expected_arrival_date
        : docRow.expected_arrival_date.toISOString().split('T')[0]
      : null,
    notes: docRow.notes,
    totals: {
      lineCount: lines.length,
      expectedQty: totalExpected,
      receivedQty: totalReceived,
      remainingQty: Math.max(0, totalExpected - totalReceived),
    },
    lines,
    createdBy: docRow.created_by,
    createdAt: docRow.created_at.toISOString(),
    updatedAt: docRow.updated_at.toISOString(),
    submittedAt: docRow.submitted_at ? docRow.submitted_at.toISOString() : null,
    completedAt: docRow.completed_at ? docRow.completed_at.toISOString() : null,
    cancelledAt: docRow.cancelled_at ? docRow.cancelled_at.toISOString() : null,
  };
}

export async function checkDuplicateReference(
  supplierKey: string,
  referenceNumber: string,
  excludeDocumentId?: string,
  client?: PoolClient
): Promise<boolean> {
  const db = client || getPool();
  const params: any[] = [supplierKey, referenceNumber];
  let excludeClause = '';

  if (excludeDocumentId) {
    excludeClause = 'AND id <> $3';
    params.push(excludeDocumentId);
  }

  const query = `
    SELECT 1
    FROM receiving_documents
    WHERE supplier_key = $1
      AND reference_number = $2
      ${excludeClause}
    LIMIT 1;
  `;

  const result = await db.query(query, params);
  return result.rows.length > 0;
}

export async function createReceivingDocument(
  doc: {
    documentNumber: string;
    supplierName: string;
    supplierKey: string;
    referenceNumber: string | null;
    expectedArrivalDate: string | null;
    notes: string | null;
    createdBy: string;
  },
  client?: PoolClient
): Promise<ReceivingDocument> {
  const db = client || getPool();
  const query = `
    INSERT INTO receiving_documents (
      document_number,
      status,
      supplier_name,
      supplier_key,
      reference_number,
      expected_arrival_date,
      notes,
      created_by,
      created_at,
      updated_at
    )
    VALUES ($1, 'DRAFT', $2, $3, $4, $5, $6, $7, now(), now())
    RETURNING 
      id,
      document_number,
      status,
      supplier_name,
      reference_number,
      expected_arrival_date,
      notes,
      created_by,
      created_at,
      updated_at;
  `;

  const result = await db.query(query, [
    doc.documentNumber,
    doc.supplierName,
    doc.supplierKey,
    doc.referenceNumber,
    doc.expectedArrivalDate,
    doc.notes,
    doc.createdBy,
  ]);

  const row = result.rows[0];
  return {
    id: row.id,
    documentNumber: row.document_number,
    status: row.status,
    supplierName: row.supplier_name,
    referenceNumber: row.reference_number,
    expectedArrivalDate: row.expected_arrival_date
      ? typeof row.expected_arrival_date === 'string'
        ? row.expected_arrival_date
        : row.expected_arrival_date.toISOString().split('T')[0]
      : null,
    notes: row.notes,
    totals: {
      lineCount: 0,
      expectedQty: 0,
      receivedQty: 0,
      remainingQty: 0,
    },
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    submittedAt: null,
    completedAt: null,
    cancelledAt: null,
  };
}

export async function updateReceivingDocumentHeader(
  id: string,
  fields: {
    supplierName?: string;
    supplierKey?: string;
    referenceNumber?: string | null;
    expectedArrivalDate?: string | null;
    notes?: string | null;
  },
  client?: PoolClient
): Promise<void> {
  const db = client || getPool();
  const setClauses: string[] = ['updated_at = now()'];
  const params: any[] = [id];
  let paramIndex = 2;

  if (fields.supplierName !== undefined && fields.supplierKey !== undefined) {
    setClauses.push(`supplier_name = $${paramIndex}`);
    params.push(fields.supplierName);
    paramIndex++;
    setClauses.push(`supplier_key = $${paramIndex}`);
    params.push(fields.supplierKey);
    paramIndex++;
  }

  if (fields.referenceNumber !== undefined) {
    setClauses.push(`reference_number = $${paramIndex}`);
    params.push(fields.referenceNumber);
    paramIndex++;
  }

  if (fields.expectedArrivalDate !== undefined) {
    setClauses.push(`expected_arrival_date = $${paramIndex}`);
    params.push(fields.expectedArrivalDate);
    paramIndex++;
  }

  if (fields.notes !== undefined) {
    setClauses.push(`notes = $${paramIndex}`);
    params.push(fields.notes);
    paramIndex++;
  }

  const query = `
    UPDATE receiving_documents
    SET ${setClauses.join(', ')}
    WHERE id = $1;
  `;

  await db.query(query, params);
}

export async function updateReceivingDocumentStatus(
  id: string,
  status: DocumentStatus,
  timestamps: {
    submittedAt?: boolean;
    completedAt?: boolean;
    cancelledAt?: boolean;
  } = {},
  client?: PoolClient
): Promise<void> {
  const db = client || getPool();
  const setClauses: string[] = [`status = $2`, `updated_at = now()`];

  if (timestamps.submittedAt) {
    setClauses.push(`submitted_at = now()`);
  }
  if (timestamps.completedAt) {
    setClauses.push(`completed_at = now()`);
  }
  if (timestamps.cancelledAt) {
    setClauses.push(`cancelled_at = now()`);
  }

  const query = `
    UPDATE receiving_documents
    SET ${setClauses.join(', ')}
    WHERE id = $1;
  `;

  await db.query(query, [id, status]);
}
