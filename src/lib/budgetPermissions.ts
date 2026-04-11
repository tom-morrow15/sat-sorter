/**
 * Budget permission helpers
 * Determines what actions a user can perform based on their role
 */

export type BudgetRole = 'owner' | 'editor' | 'viewer';

interface Permissions {
  canEdit: boolean;
  canDelete: boolean;
  canManagePartners: boolean;
  canExportImport: boolean;
  canViewOnly: boolean;
}

export function getPermissions(role: BudgetRole): Permissions {
  switch (role) {
    case 'owner':
      return {
        canEdit: true,
        canDelete: true,
        canManagePartners: true,
        canExportImport: true,
        canViewOnly: false,
      };
    case 'editor':
      return {
        canEdit: true,
        canDelete: false, // Editors can't delete
        canManagePartners: false,
        canExportImport: false,
        canViewOnly: false,
      };
    case 'viewer':
      return {
        canEdit: false,
        canDelete: false,
        canManagePartners: false,
        canExportImport: false,
        canViewOnly: true,
      };
    default:
      return {
        canEdit: false,
        canDelete: false,
        canManagePartners: false,
        canExportImport: false,
        canViewOnly: true,
      };
  }
}

export function canAddBucket(role: BudgetRole): boolean {
  return getPermissions(role).canEdit;
}

export function canDeleteBucket(role: BudgetRole): boolean {
  return getPermissions(role).canDelete;
}

export function canAddLineItem(role: BudgetRole): boolean {
  return getPermissions(role).canEdit;
}

export function canEditLineItem(role: BudgetRole): boolean {
  return getPermissions(role).canEdit;
}

export function canDeleteLineItem(role: BudgetRole): boolean {
  return getPermissions(role).canDelete;
}

export function canAddTransaction(role: BudgetRole): boolean {
  return getPermissions(role).canEdit;
}

export function canDeleteTransaction(role: BudgetRole): boolean {
  return getPermissions(role).canDelete;
}

export function canAssignTransaction(role: BudgetRole): boolean {
  return getPermissions(role).canEdit;
}

export function canManagePartners(role: BudgetRole): boolean {
  return getPermissions(role).canManagePartners;
}

export function canExportImport(role: BudgetRole): boolean {
  return getPermissions(role).canExportImport;
}

export function getRoleLabel(role: BudgetRole): string {
  switch (role) {
    case 'owner':
      return 'Budget Owner';
    case 'editor':
      return 'Editor';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Unknown';
  }
}

export function getRoleDescription(role: BudgetRole): string {
  switch (role) {
    case 'owner':
      return 'Full control - can edit, delete, and manage partners';
    case 'editor':
      return 'Can edit transactions and categories, but cannot delete';
    case 'viewer':
      return 'View-only access - cannot make any changes';
    default:
      return '';
  }
}
