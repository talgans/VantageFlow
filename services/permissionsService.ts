import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface PermissionConfig {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    isSystem: boolean;
    description: string;
}

export interface RolePermissions {
    [roleName: string]: PermissionConfig;
}

export interface RolePermissionsDocument {
    roles: RolePermissions;
    updatedAt?: any;
    updatedBy?: string;
}

// Default system permissions
const DEFAULT_PERMISSIONS: RolePermissions = {
    admin: {
        create: true,
        read: true,
        update: true,
        delete: true,
        isSystem: true,
        description: 'Full system access'
    },
    manager: {
        create: true,
        read: true,
        update: true,
        delete: false,
        isSystem: true,
        description: 'Can create and manage projects'
    },
    member: {
        create: false,
        read: true,
        update: false,
        delete: false,
        isSystem: true,
        description: 'View-only access'
    }
};

const PERMISSIONS_DOC_PATH = 'rolePermissions/config';

/**
 * Get role permissions from Firestore
 * Falls back to defaults if no document exists
 */
export const getPermissions = async (): Promise<RolePermissions> => {
    try {
        const docRef = doc(db, PERMISSIONS_DOC_PATH);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as RolePermissionsDocument;
            return data.roles || DEFAULT_PERMISSIONS;
        }

        // Return defaults if no document exists
        return { ...DEFAULT_PERMISSIONS };
    } catch (error) {
        console.error('Error fetching permissions:', error);
        // Return defaults on error
        return { ...DEFAULT_PERMISSIONS };
    }
};

/**
 * Save role permissions to Firestore
 */
export const savePermissions = async (
    permissions: RolePermissions,
    userEmail: string
): Promise<void> => {
    try {
        const docRef = doc(db, PERMISSIONS_DOC_PATH);
        await setDoc(docRef, {
            roles: permissions,
            updatedAt: serverTimestamp(),
            updatedBy: userEmail
        });
    } catch (error) {
        console.error('Error saving permissions:', error);
        throw new Error('Failed to save permissions. Please try again.');
    }
};

/**
 * Add a new custom role
 */
export const addRole = (
    currentPermissions: RolePermissions,
    roleName: string,
    description: string = ''
): RolePermissions => {
    // Validate role name
    const sanitizedName = roleName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    if (!sanitizedName) {
        throw new Error('Role name is required');
    }

    if (currentPermissions[sanitizedName]) {
        throw new Error(`Role "${sanitizedName}" already exists`);
    }

    return {
        ...currentPermissions,
        [sanitizedName]: {
            create: false,
            read: true,
            update: false,
            delete: false,
            isSystem: false,
            description: description || `Custom role: ${sanitizedName}`
        }
    };
};

/**
 * Delete a custom role (only non-system roles can be deleted)
 */
export const deleteRole = (
    currentPermissions: RolePermissions,
    roleName: string
): RolePermissions => {
    const role = currentPermissions[roleName];

    if (!role) {
        throw new Error(`Role "${roleName}" does not exist`);
    }

    if (role.isSystem) {
        throw new Error(`Cannot delete system role "${roleName}"`);
    }

    const { [roleName]: _, ...remainingPermissions } = currentPermissions;
    return remainingPermissions;
};

/**
 * Get the default permissions (for initialization)
 */
export const getDefaultPermissions = (): RolePermissions => {
    return { ...DEFAULT_PERMISSIONS };
};

/**
 * Check if two permission configurations are equal
 */
export const permissionsEqual = (a: RolePermissions, b: RolePermissions): boolean => {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();

    if (aKeys.length !== bKeys.length) return false;
    if (aKeys.join(',') !== bKeys.join(',')) return false;

    for (const key of aKeys) {
        if (
            a[key].create !== b[key].create ||
            a[key].read !== b[key].read ||
            a[key].update !== b[key].update ||
            a[key].delete !== b[key].delete
        ) {
            return false;
        }
    }

    return true;
};
