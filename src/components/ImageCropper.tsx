import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface ImageCropperProps {
  imageSrc: string;
  onCropDone: (croppedFile: File) => void;
  onCancel: () => void;
}

export default function ImageCropper({ imageSrc, onCropDone, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleDone = useCallback(async () => {
    if (!croppedAreaPixels) return;

    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => { image.onload = resolve; });

    const canvas = document.createElement("canvas");
    const size = Math.max(croppedAreaPixels.width, croppedAreaPixels.height);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f4f1eb";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      size,
      size
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });
        onCropDone(file);
      },
      "image/jpeg",
      0.9
    );
  }, [croppedAreaPixels, imageSrc, onCropDone]);

  return (
    <div className="relative w-full" style={{ aspectRatio: "1/1" }}>
      <Cropper
        image={imageSrc}
        crop={crop}
        zoom={zoom}
        aspect={1}
        onCropChange={setCrop}
        onZoomChange={setZoom}
        onCropComplete={onCropComplete}
        style={{
          containerStyle: { borderRadius: "2px" },
        }}
      />
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 z-10">
        <button
          onClick={onCancel}
          className="font-mono text-[0.55rem] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm border bg-background/90 text-muted-foreground hover:text-foreground transition-all"
          style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
        >
          Cancel
        </button>
        <button
          onClick={handleDone}
          className="font-mono text-[0.55rem] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light"
        >
          Crop
        </button>
      </div>
    </div>
  );
}
