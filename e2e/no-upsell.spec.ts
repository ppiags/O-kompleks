import { expect, test } from '@playwright/test'

test('E2E 2 — сценарий без допродажи', async ({ page }) => {
  await page.goto('/')

  await page.getByTestId('preset-support').click()
  await page.getByTestId('analyze-button').click()

  await expect(page.getByTestId('customer-reply')).toBeVisible()
  const notRecommended = page.getByTestId('upsell-not-recommended')
  await expect(notRecommended).toBeVisible()
  await expect(notRecommended).toContainText(/навязыв|не стоит/i)
  await expect(page.getByTestId('upsell-block')).toHaveCount(0)
  await expect(page.getByTestId('copy-pitch')).toHaveCount(0)
})
