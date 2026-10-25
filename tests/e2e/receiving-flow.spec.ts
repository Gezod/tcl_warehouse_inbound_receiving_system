import { test, expect } from '@playwright/test';

test.describe('End-to-End Inbound Receiving Workflow', () => {
  const runId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const testSku = `E2E-${runId}`;
  const testProductName = `E2E Test Component ${runId}`;
  const testSupplier = `E2E Supplier ${runId}`;
  const testRef = `REF-${runId}`;

  test('executes complete receiving lifecycle: Supervisor product creation, doc draft, line add, submit, Operator receipt, stock reflection, and completion', async ({
    page,
  }) => {
    // Automatically accept browser confirm() dialogs (e.g. submit document, complete document)
    page.on('dialog', (dialog) => dialog.accept());

    // -------------------------------------------------------------------------
    // Step 1: Supervisor Login
    // -------------------------------------------------------------------------
    await page.goto('/login');
    await page.waitForSelector('form[data-hydrated="true"]');
    await expect(page.locator('h1')).toContainText('Warehouse Receiving');

    await page.fill('input#username', 'supervisor');
    await page.fill('input#password', 'SupervisorPass123!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Dashboard');

    // -------------------------------------------------------------------------
    // Step 2: Create Active Product in Catalogue
    // -------------------------------------------------------------------------
    await page.goto('/products');
    await expect(page.locator('h1')).toContainText('Products');

    await page.click('button:has-text("New Product")');
    await expect(page.locator('#sheet-title')).toContainText('New Product');

    await page.fill('input#product-sku', testSku);
    await page.fill('input#product-name', testProductName);
    await page.fill('input#product-unit', 'pcs');
    await page.click('button[type="submit"]:has-text("Create Product")');

    // Product should appear in catalogue table
    await expect(page.locator(`text=${testSku}`)).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // Step 3: Create Receiving Document Draft
    // -------------------------------------------------------------------------
    await page.goto('/receiving-documents/new');
    await expect(page.locator('h1')).toContainText('New Receiving Document');

    await page.fill('input#supplierName', testSupplier);
    await page.fill('input#referenceNumber', testRef);
    await page.fill('input#expectedArrivalDate', '2026-11-20');
    await page.fill('textarea#notes', 'E2E inbound delivery batch');
    await page.click('button[type="submit"]:has-text("Create Receiving Document")');

    // Should redirect to the document detail page
    await expect(page).toHaveURL(/\/receiving-documents\/[a-f0-9-]+$/);
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.locator(`text=${testSupplier}`)).toBeVisible();

    // -------------------------------------------------------------------------
    // Step 4: Add Line with Expected Quantity 10
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Add Line")');
    await expect(page.locator('text=Add Expected Line')).toBeVisible();

    // Select the newly created product from the dropdown
    const productOption = page.locator(`select option:has-text("${testSku}")`);
    await expect(productOption).toBeAttached({ timeout: 10000 });
    const optionValue = await productOption.getAttribute('value');
    await page.locator('select').first().selectOption(optionValue!);

    await page.fill('form input[type="number"]', '10');
    await page.click('button[type="submit"]:has-text("Add Line")');

    // Verify line appears in table
    await expect(page.locator(`text=${testSku}`)).toBeVisible();
    await expect(
      page
        .locator('#lines-table tr', { hasText: testSku })
        .getByRole('cell', { name: '10', exact: true })
        .first()
    ).toBeVisible();

    // -------------------------------------------------------------------------
    // Step 5: Submit Document (DRAFT -> OPEN)
    // -------------------------------------------------------------------------
    await page.click('button:has-text("Submit Document")');
    await expect(page.getByText('Open', { exact: true })).toBeVisible({ timeout: 10000 });

    const documentUrl = page.url();

    // -------------------------------------------------------------------------
    // Step 6: Log out as Supervisor & Log in as Operator
    // -------------------------------------------------------------------------
    await page.click('#desktop-sign-out-btn');
    await expect(page).toHaveURL('/login');
    await page.waitForSelector('form[data-hydrated="true"]');

    await page.fill('input#username', 'operator');
    await page.fill('input#password', 'OperatorPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 7: Operator Records Partial Receipt (4 units)
    // -------------------------------------------------------------------------
    await page.goto(documentUrl);
    await expect(page.getByText('Open', { exact: true })).toBeVisible();

    await page.click('button:has-text("Record Receipts")');
    await expect(page.locator('text=Record Inbound Receipts')).toBeVisible();

    // Fill quantity 4 for the line in the receipt dialog
    const qtyInput = page.locator('form input[type="number"]').last();
    await qtyInput.fill('4');
    await page.click('button[type="submit"]:has-text("Confirm Receipts")');

    // Document status transitions to Partially received
    await expect(page.getByText('Partially received', { exact: true })).toBeVisible({ timeout: 10000 });
    // Received qty 4, Remaining qty 6 in Lines Table
    const lineRowPartial = page.locator('#lines-table tr', { hasText: testSku });
    await expect(lineRowPartial.getByRole('cell', { name: '4', exact: true })).toBeVisible();
    await expect(lineRowPartial.getByRole('cell', { name: '6', exact: true })).toBeVisible();

    // -------------------------------------------------------------------------
    // Step 8: Verify Stock On Hand in Inventory
    // -------------------------------------------------------------------------
    await page.goto('/inventory');
    await expect(page.locator('h1')).toContainText('Inventory');

    // Search for our test SKU
    await page.fill('input[placeholder*="Search"]', testSku);
    await expect(page.locator(`text=${testSku}`)).toBeVisible();
    // Verify On Hand = 4
    await expect(
      page
        .locator(`tr:has-text("${testSku}")`)
        .getByRole('cell', { name: '4', exact: true })
        .first()
    ).toBeVisible();

    // -------------------------------------------------------------------------
    // Step 9: Switch to Supervisor & Complete Document
    // -------------------------------------------------------------------------
    await page.click('#desktop-sign-out-btn');
    await expect(page).toHaveURL('/login');
    await page.waitForSelector('form[data-hydrated="true"]');

    await page.fill('input#username', 'supervisor');
    await page.fill('input#password', 'SupervisorPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 15000 });

    await page.goto(documentUrl);
    await expect(page.getByText('Partially received', { exact: true })).toBeVisible();

    // Record remaining 6 units
    await page.click('button:has-text("Record Receipts")');
    await expect(page.locator('text=Record Inbound Receipts')).toBeVisible();
    await page.click('button:has-text("Receive All Remaining")');
    await page.click('button[type="submit"]:has-text("Confirm Receipts")');

    // Fully received: 10 received, 0 remaining in Lines Table
    const lineRowFinal = page.locator('#lines-table tr', { hasText: testSku });
    await expect(
      lineRowFinal.getByRole('cell', { name: '10', exact: true }).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(lineRowFinal.getByRole('cell', { name: '0', exact: true })).toBeVisible();

    // Complete document (Supervisor only)
    await page.click('button:has-text("Complete Document")');
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10000 });

    // In terminal COMPLETED state, Record Receipts and Complete buttons are no longer present
    await expect(page.locator('button:has-text("Record Receipts")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Complete Document")')).toHaveCount(0);
  });
});
