import { expect, test } from '@playwright/test'

test('E2E 3 — пустой ввод не отправляется', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('provider-status')).toContainText('Mock')

  await page.getByTestId('analyze-button').click()

  await expect(page.getByTestId('validation-error')).toContainText(/введите обращение/i)
  await expect(page.getByTestId('customer-reply')).toHaveCount(0)
})

test('E2E 4 — состояние ошибки провайдера отображается корректно', async ({ page }) => {
  await page.route('**/api/ai', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'PROVIDER_ERROR', message: 'Провайдер недоступен.' } }),
      })
      return
    }
    await route.continue()
  })

  await page.goto('/')
  await page.getByTestId('preset-team-crm').click()
  await page.getByTestId('analyze-button').click()

  const errorState = page.getByTestId('error-state')
  await expect(errorState).toBeVisible()
  await expect(errorState).toContainText(/провайдер недоступен/i)
  await expect(errorState).not.toContainText('Error:')
  await expect(page.getByTestId('customer-reply')).toHaveCount(0)
})
