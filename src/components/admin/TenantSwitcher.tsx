'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface TenantOption {
  id: string
  name: string
}

export function TenantSwitcher({
  tenants,
  currentTenantId,
}: {
  tenants: TenantOption[]
  currentTenantId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(tenantId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tenantId', tenantId)
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <select
      value={currentTenantId}
      onChange={(e) => onChange(e.target.value)}
      className="border p-1 text-sm"
      aria-label="Switch tenant"
    >
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.name}
        </option>
      ))}
    </select>
  )
}
