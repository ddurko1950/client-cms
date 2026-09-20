import { test, expect } from '@playwright/test'
import { seedE2eTenant } from './seed'

test('login, edit a block, preview, publish, and roll back', async ({ page }) => {
  const { pageId } = await seedE2eTenant()

  await page.goto('/login')
  await page.getByPlaceholder('Email').fill('e2e@example.com')
  await page.getByPlaceholder('Password').fill('e2e-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin/)

  await page.goto(`/admin/pages/${pageId}/edit`)
  await page.getByRole('button', { name: /add text block/i }).click()
  await page.getByLabel(/body/i).fill('Hello from Playwright')
  await page.getByRole('button', { name: /save draft/i }).click()

  await page.goto(`/api/preview?pageId=${pageId}`)
  await expect(page.getByText('Hello from Playwright')).toBeVisible()

  await page.goto(`/admin/pages/${pageId}/edit`)
  await page.getByRole('button', { name: /^publish$/i }).click()

  await page.goto(`/admin/pages/${pageId}/versions`)
  await expect(page.getByText(/version 1/i)).toBeVisible()
  await page.getByRole('button', { name: /roll back/i }).first().click()
})
