export type ProcessedImage = {
  blob: Blob;
  webpUrl: string;
  size: number;
};

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = url;
  });
}

export async function processStageReference(file: File): Promise<ProcessedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }

    const scale = Math.max(size / image.width, size / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (size - width) / 2;
    const y = (size - height) / 2;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, x, y, width, height);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else reject(new Error("Failed to convert canvas to blob"));
        },
        "image/webp",
        0.9
      );
    });

    const webpUrl = URL.createObjectURL(blob);

    return {
      blob,
      webpUrl,
      size: blob.size
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
