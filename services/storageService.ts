import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebaseConfig';

/**
 * Upload a profile photo for a user
 * @param userId - The user's ID
 * @param file - The file to upload
 * @returns Promise<string> - The download URL of the uploaded photo
 */
export const uploadProfilePhoto = async (userId: string, file: File): Promise<string> => {
    try {
        // Create a reference to 'profile_photos/<userId>/<timestamp>_<filename>'
        // Adding timestamp to avoid caching issues and ensure uniqueness
        const timestamp = Date.now();
        const filename = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `profile_photos/${userId}/${filename}`);

        // Upload the file
        await uploadBytes(storageRef, file);

        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading profile photo:', error);
        throw new Error('Failed to upload profile photo');
    }
};
