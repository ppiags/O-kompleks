import { expect, test } from '@playwright/test'

test('E2E 1 — основной сценарий: команда + CRM', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('provider-status')).toContainText('Mock')

  await page.getByTestId('preset-team-crm').click()
  await expect(page.getByTestId('request-input')).toHaveValue(/12 человек/)

  await page.getByTestId('analyze-button').click()

  const reply = page.getByTestId('customer-reply')
  await expect(reply).toBeVisible()
  await expect(reply).toContainText('CRM')
  await expect(reply).toContainText('₽')

  const upsell = page.getByTestId('upsell-block')
  await expect(upsell).toBeVisible()
  await expect(upsell).toContainText('Допродажа')
  await expect(page.getByTestId('copy-reply')).toBeVisible()
  await expect(page.getByTestId('copy-pitch')).toBeVisible()

  const matches = page.getByTestId('knowledge-matches')
  await expect(matches).toBeVisible()
  await expect(matches).toContainText('Интеграция с CRM')

  await expect(page.getByTestId('status-line')).toContainText('AI provider: Mock')
  await expect(page.getByTestId('status-line')).toContainText('Knowledge matches:')
})
