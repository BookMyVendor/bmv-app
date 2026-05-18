import { axiosFunctionsCall } from '../axiosClient';

/** Spec: file-storage-url { file_id: string } or { id: string } -> { success: true, file_id, url } */
export async function getFileUrl(fileId: string) {
  const res = await axiosFunctionsCall<{ file_id: string; url: string }>('file-storage-url', { file_id: fileId });
  if (!res.data) return { data: undefined, error: res.error };
  return { data: { url: res.data.url }, error: res.error };
}
