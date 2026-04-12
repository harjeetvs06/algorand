export type Role = 'supplier' | 'approver' | 'distributor' | 'retailer'

export const ROLES: Record<Role, string> = {
  supplier: 'Supplier',
  approver: 'Approver',
  distributor: 'Distributor',
  retailer: 'Retailer',
}

export const ROLE_ACTIONS: Record<Role, string[]> = {
  supplier: ['create_batch', 'view_batch'],
  approver: ['inspect_batch', 'view_batch'],
  distributor: ['distribute_batch', 'view_batch'],
  retailer: ['recall_batch', 'view_batch'],
}