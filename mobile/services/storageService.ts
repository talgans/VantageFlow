import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './firebaseConfig';

/**
 * Request camera & library permissions
 */
export const requestMediaPermissions = async (): Promise<boolean> => {
  const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  return library.granted && camera.granted;
};

/**
 * Pick an image from gallery or take a new photo with camera, then upload to Firebase Storage
 */
export const pickAndUploadTaskImage = async (
  projectId: string,
  taskId: string,
  source: 'camera' | 'library' = 'library'
): Promise<string | null> => {
  try {
    let result: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
    }

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const asset = result.assets[0];
    const timestamp = Date.now();
    const filename = `${timestamp}_task_deliverable.jpg`;

    if (!isFirebaseConfigured()) {
      // In dev / mock mode, return local asset URI
      console.log('[Storage] Mock upload, using local asset URI:', asset.uri);
      return asset.uri;
    }

    // Convert URI to Blob
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const storageRef = ref(storage, `task_images/${projectId}/${taskId}/${filename}`);
    await uploadBytes(storageRef, blob);

    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('[Storage] Image upload failed:', error);
    throw new Error('Failed to upload task image');
  }
};
