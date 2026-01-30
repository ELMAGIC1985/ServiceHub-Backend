const ROLES = {
  USER: 'user',
  VENDOR: 'vendor',
  ADMIN: 'admin',
  ROOT_ADMIN: 'root_admin',
};

const PERMISSIONS = {
  // User management
  READ_USERS: 'read_users',
  WRITE_USERS: 'write_users',
  DELETE_USERS: 'delete_users',

  // Vendor management
  READ_VENDORS: 'read_vendors',
  WRITE_VENDORS: 'write_vendors',
  DELETE_VENDORS: 'delete_vendors',

  // Product management
  READ_PRODUCTS: 'read_products',
  WRITE_PRODUCTS: 'write_products',
  DELETE_PRODUCTS: 'delete_products',

  // Order management
  READ_ORDERS: 'read_orders',
  WRITE_ORDERS: 'write_orders',
  DELETE_ORDERS: 'delete_orders',

  // Admin management
  MANAGE_ADMINS: 'manage_admins',
  SYSTEM_SETTINGS: 'system_settings',
};

// Default permissions for each role
const ROLE_PERMISSIONS = {
  [ROLES.USER]: [PERMISSIONS.READ_PRODUCTS, PERMISSIONS.WRITE_ORDERS, PERMISSIONS.READ_ORDERS],

  [ROLES.VENDOR]: [
    PERMISSIONS.READ_PRODUCTS,
    PERMISSIONS.WRITE_PRODUCTS,
    PERMISSIONS.READ_ORDERS,
    PERMISSIONS.WRITE_ORDERS,
    PERMISSIONS.READ_USERS,
  ],

  [ROLES.ADMIN]: [
    PERMISSIONS.READ_USERS,
    PERMISSIONS.WRITE_USERS,
    PERMISSIONS.READ_VENDORS,
    PERMISSIONS.WRITE_VENDORS,
    PERMISSIONS.READ_PRODUCTS,
    PERMISSIONS.WRITE_PRODUCTS,
    PERMISSIONS.DELETE_PRODUCTS,
    PERMISSIONS.READ_ORDERS,
    PERMISSIONS.WRITE_ORDERS,
    PERMISSIONS.DELETE_ORDERS,
  ],

  [ROLES.ROOT_ADMIN]: Object.values(PERMISSIONS), // All permissions
};

// Function to get permissions for a role
const getPermissionsForRole = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

// Function to check if role has permission
const hasPermission = (userPermissions, requiredPermission) => {
  return userPermissions.includes(requiredPermission);
};

export { ROLES, PERMISSIONS, ROLE_PERMISSIONS, getPermissionsForRole, hasPermission };
