const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

if (!cloudName) {
  console.warn('Missing REACT_APP_CLOUDINARY_CLOUD_NAME in environment');
}

export async function uploadToCloudinary(file: File, opts?: { publicId?: string }) {
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables are missing.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  if (opts?.publicId) {
    formData.append('public_id', opts.publicId);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const data = await response.json();
  const pngUrl = data.format !== 'png'
    ? `https://res.cloudinary.com/${cloudName}/image/upload/f_png/${data.public_id}`
    : data.secure_url;

  return {
    publicId: data.public_id as string,
    secureUrl: data.secure_url as string,
    format: data.format as string,
    bytes: data.bytes as number,
    width: data.width as number,
    height: data.height as number,
    originalFilename: data.original_filename as string,
    pngUrl,
  };
}
