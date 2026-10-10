export async function prepareImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preparation unavailable.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error("Image conversion failed.")), "image/jpeg", 0.85,
    ));
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error());
      reader.onerror = () => reject(new Error());
      reader.onabort = () => reject(new Error());
      reader.readAsDataURL(blob);
    });
    return { imageBase64: data.slice(data.indexOf(",") + 1), mimeType: "image/jpeg" };
  } finally { bitmap.close(); }
}
