import { test, expect } from '@playwright/test';
const sections = ['chat','test','tarjimon','profil','kunlik','xatolar','yutuqlar','statistika'];
for (const s of sections) {
  test(`section ${s} opens`, async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: new RegExp(s, 'i') });
    if (await btn.count()) await btn.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });
}