const PERMISSIONS = [
  "read",
  "edit_reports",
  "edit_model",
  "explore_connections",
  "manage_connections",
  "register_developments",
  "manage_users",
];

let granted = new Set();

let restrictedRows = false;

export function applyPermissions(permissions) {
  granted = new Set(permissions);
  for (const permission of PERMISSIONS) {
    document.body.classList.toggle(`can-${permission}`, granted.has(permission));
  }
}

export function applyCompanyScope(user) {
  restrictedRows = user.role === "viewer" && Array.isArray(user.companies);
  document.body.classList.toggle("company-restricted", restrictedRows);
}

export function restricted() {
  return restrictedRows;
}

export function can(permission) {
  return granted.has(permission);
}

export function requiring(permission, node) {
  if (node) {
    node.dataset.requires = permission;
  }
  return node;
}
