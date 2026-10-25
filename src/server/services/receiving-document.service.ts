import { AppError } from '../errors';
import { requireRole } from '../auth/guard';
import {
  CurrentUser,
  ReceivingDocument,
  ReceivingDocumentDetail,
  ReceivingDocumentPage,
  ReceivingLine,
  User,
} from '@/src/types/domain';
import {
  LineCreateInput,
  LineUpdateInput,
  ReceivingDocumentCreateInput,
  ReceivingDocumentQueryInput,
  ReceivingDocumentUpdateInput,
} from '@/src/lib/validation/receiving-document.schema';
import {
  checkDuplicateReference,
  createReceivingDocument as repoCreateReceivingDocument,
  findReceivingDocumentById,
  findReceivingDocuments,
  updateReceivingDocumentHeader,
  updateReceivingDocumentStatus,
} from '../repositories/receiving-document.repository';
import {
  checkProductOnDocument,
  countLinesForDocument,
  createReceivingLine,
  deleteReceivingLine,
  findLineById,
  updateLineExpectedQty,
} from '../repositories/receiving-line.repository';
import { findProductById } from '../repositories/product.repository';
import { generateDocumentNumber } from '../repositories/document-counter.repository';
import { withTransaction } from '../db/tx';

export async function listReceivingDocuments(
  query: ReceivingDocumentQueryInput
): Promise<ReceivingDocumentPage> {
  const { documents, total } = await findReceivingDocuments({
    status: query.status,
    supplier: query.supplier,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
  });

  return {
    data: documents,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

export async function getReceivingDocument(id: string): Promise<ReceivingDocumentDetail> {
  const doc = await findReceivingDocumentById(id);
  if (!doc) {
    throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
  }
  return doc;
}

export async function createDocument(
  user: User | CurrentUser,
  input: ReceivingDocumentCreateInput
): Promise<ReceivingDocument> {
  // Operator and Supervisor allowed
  const supplierName = input.supplierName.trim();
  const supplierKey = supplierName.toLowerCase();
  const ref = input.referenceNumber ? input.referenceNumber.trim() : null;

  return withTransaction(async (client) => {
    // BR-14: Reference number is unique per supplier when provided
    if (ref) {
      const isDup = await checkDuplicateReference(supplierKey, ref, undefined, client);
      if (isDup) {
        throw new AppError(
          409,
          'DUPLICATE_REFERENCE',
          'A receiving document with this reference number already exists for this supplier.',
          'referenceNumber'
        );
      }
    }

    // BR-15: Generated document number RD-YYYY-NNNNNN
    const documentNumber = await generateDocumentNumber(client);

    return repoCreateReceivingDocument(
      {
        documentNumber,
        supplierName,
        supplierKey,
        referenceNumber: ref,
        expectedArrivalDate: input.expectedArrivalDate || null,
        notes: input.notes ? input.notes.trim() : null,
        createdBy: user.id,
      },
      client
    );
  });
}

export async function updateDocumentHeader(
  user: User | CurrentUser,
  id: string,
  input: ReceivingDocumentUpdateInput
): Promise<ReceivingDocumentDetail> {
  return withTransaction(async (client) => {
    const doc = await findReceivingDocumentById(id, { forUpdate: true }, client);
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
    }

    // BR-08: COMPLETED and CANCELLED are terminal
    if (doc.status === 'COMPLETED' || doc.status === 'CANCELLED') {
      throw new AppError(
        409,
        'INVALID_DOCUMENT_STATE',
        `Document is ${doc.status} and cannot be modified.`
      );
    }

    // DRAFT vs OPEN/PARTIALLY_RECEIVED permissions
    if (doc.status === 'DRAFT') {
      // Both Operator and Supervisor can update header in DRAFT
      const newSupplierName =
        input.supplierName !== undefined ? input.supplierName.trim() : doc.supplierName;
      const newSupplierKey = newSupplierName.toLowerCase();
      const newRef =
        input.referenceNumber !== undefined
          ? input.referenceNumber
            ? input.referenceNumber.trim()
            : null
          : doc.referenceNumber;

      if (newRef) {
        const isDup = await checkDuplicateReference(newSupplierKey, newRef, doc.id, client);
        if (isDup) {
          throw new AppError(
            409,
            'DUPLICATE_REFERENCE',
            'A receiving document with this reference number already exists for this supplier.',
            'referenceNumber'
          );
        }
      }

      await updateReceivingDocumentHeader(
        id,
        {
          ...(input.supplierName !== undefined
            ? { supplierName: newSupplierName, supplierKey: newSupplierKey }
            : {}),
          ...(input.referenceNumber !== undefined ? { referenceNumber: newRef } : {}),
          ...(input.expectedArrivalDate !== undefined
            ? { expectedArrivalDate: input.expectedArrivalDate || null }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes ? input.notes.trim() : null } : {}),
        },
        client
      );
    } else {
      // Status is OPEN or PARTIALLY_RECEIVED
      // Only Supervisor can update header, and ONLY notes may be changed
      if (user.role !== 'SUPERVISOR') {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Only supervisors can edit documents after submission.'
        );
      }

      if (
        input.supplierName !== undefined ||
        input.referenceNumber !== undefined ||
        input.expectedArrivalDate !== undefined
      ) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Only the notes field may be modified on an open document.'
        );
      }

      if (input.notes !== undefined) {
        await updateReceivingDocumentHeader(
          id,
          { notes: input.notes ? input.notes.trim() : null },
          client
        );
      }
    }

    const updated = await findReceivingDocumentById(id, {}, client);
    return updated!;
  });
}

export async function addDocumentLine(
  user: User | CurrentUser,
  documentId: string,
  input: LineCreateInput
): Promise<ReceivingLine> {
  // Operator and Supervisor allowed in DRAFT
  return withTransaction(async (client) => {
    const doc = await findReceivingDocumentById(documentId, { forUpdate: true }, client);
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
    }

    if (doc.status !== 'DRAFT') {
      throw new AppError(
        409,
        'INVALID_DOCUMENT_STATE',
        `Lines can only be added to a DRAFT document (current status is ${doc.status}).`
      );
    }

    const product = await findProductById(input.productId, client);
    if (!product) {
      throw new AppError(404, 'NOT_FOUND', 'Product not found.', 'productId');
    }

    // BR-12: Deactivated products cannot be added to new lines
    if (!product.isActive) {
      throw new AppError(
        422,
        'PRODUCT_INACTIVE',
        'Cannot add an inactive product to a receiving document.',
        'productId'
      );
    }

    // BR-11: A product may appear only once per document
    const alreadyOnDoc = await checkProductOnDocument(documentId, input.productId, client);
    if (alreadyOnDoc) {
      throw new AppError(
        409,
        'DUPLICATE_PRODUCT_ON_DOCUMENT',
        'This product is already present on this receiving document.',
        'productId'
      );
    }

    return createReceivingLine(documentId, input.productId, input.expectedQty, client);
  });
}

export async function updateDocumentLine(
  user: User | CurrentUser,
  documentId: string,
  lineId: string,
  input: LineUpdateInput
): Promise<ReceivingLine> {
  return withTransaction(async (client) => {
    const doc = await findReceivingDocumentById(documentId, { forUpdate: true }, client);
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
    }

    if (doc.status === 'COMPLETED' || doc.status === 'CANCELLED') {
      throw new AppError(
        409,
        'INVALID_DOCUMENT_STATE',
        `Document is ${doc.status} and cannot be modified.`
      );
    }

    const line = await findLineById(lineId, client);
    if (!line || line.documentId !== documentId) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving line not found on this document.');
    }

    if (doc.status === 'DRAFT') {
      // Both roles allowed to update expectedQty >= 1
      return updateLineExpectedQty(lineId, input.expectedQty, client);
    }

    // OPEN or PARTIALLY_RECEIVED: Supervisor only
    if (user.role !== 'SUPERVISOR') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only supervisors can edit expected quantities after submission.'
      );
    }

    // FR-09: Decreases allowed only down to current received quantity
    if (input.expectedQty < line.receivedQty) {
      throw new AppError(
        422,
        'LINE_NOT_EDITABLE',
        `Expected quantity cannot be decreased below received quantity (${line.receivedQty}).`,
        'expectedQty'
      );
    }

    return updateLineExpectedQty(lineId, input.expectedQty, client);
  });
}

export async function removeDocumentLine(
  user: User | CurrentUser,
  documentId: string,
  lineId: string
): Promise<void> {
  return withTransaction(async (client) => {
    const doc = await findReceivingDocumentById(documentId, { forUpdate: true }, client);
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
    }

    if (doc.status !== 'DRAFT') {
      throw new AppError(
        409,
        'INVALID_DOCUMENT_STATE',
        'Lines can only be removed from a DRAFT document.'
      );
    }

    const line = await findLineById(lineId, client);
    if (!line || line.documentId !== documentId) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving line not found on this document.');
    }

    if (line.receivedQty > 0) {
      throw new AppError(
        409,
        'DOCUMENT_HAS_RECEIPTS',
        'Cannot remove a line that has recorded receipts.'
      );
    }

    await deleteReceivingLine(lineId, client);
  });
}

export async function submitDocument(
  user: User | CurrentUser,
  documentId: string
): Promise<ReceivingDocumentDetail> {
  return withTransaction(async (client) => {
    const doc = await findReceivingDocumentById(documentId, { forUpdate: true }, client);
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
    }

    if (doc.status !== 'DRAFT') {
      throw new AppError(
        409,
        'INVALID_DOCUMENT_STATE',
        `Only DRAFT documents can be submitted (current status is ${doc.status}).`
      );
    }

    // US-04 / FR-08: Requires at least one line
    const lineCount = await countLinesForDocument(documentId, client);
    if (lineCount === 0) {
      throw new AppError(
        422,
        'NO_LINES',
        'A receiving document must have at least one line before it can be submitted.'
      );
    }

    await updateReceivingDocumentStatus(documentId, 'OPEN', { submittedAt: true }, client);

    const updated = await findReceivingDocumentById(documentId, {}, client);
    return updated!;
  });
}

export async function cancelDocument(
  user: User | CurrentUser,
  documentId: string
): Promise<ReceivingDocumentDetail> {
  // FR-13: Supervisor only
  requireRole(user, ['SUPERVISOR']);

  return withTransaction(async (client) => {
    const doc = await findReceivingDocumentById(documentId, { forUpdate: true }, client);
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Receiving document not found.');
    }

    if (doc.status === 'COMPLETED' || doc.status === 'CANCELLED') {
      throw new AppError(
        409,
        'INVALID_DOCUMENT_STATE',
        `Document is already ${doc.status} and cannot be cancelled.`
      );
    }

    // BR-07: A document with at least one recorded receipt cannot be cancelled
    if (doc.totals.receivedQty > 0) {
      throw new AppError(
        409,
        'DOCUMENT_HAS_RECEIPTS',
        'A document with recorded receipts cannot be cancelled.'
      );
    }

    await updateReceivingDocumentStatus(documentId, 'CANCELLED', { cancelledAt: true }, client);

    const updated = await findReceivingDocumentById(documentId, {}, client);
    return updated!;
  });
}
