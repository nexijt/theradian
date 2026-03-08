import React, { useState, useRef, useCallback } from "react";
import { createPost, hasPostedToday } from "@/lib/posts";
import { trimAudioToSeconds } from "@/lib/audio-utils";
import { useToast } from "@/hooks/use-toast";
import ImageCropper from "./ImageCropper";

const AUDIO_TAGS = ["MUSIC", "VA", "WRITING", "SFX"] as const;

interface CreatePostSheetProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onPostCreated: () => void;
}

export default function CreatePostSheet({ open, onClose, userId, onPostCreated }: CreatePostSheetProps) {
  const [postType, setPostType] = useState<"photo" | "audio">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [caption, setCaption] = useState("");
  const [audioTag, setAudioTag] = useState<string>("MUSIC");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (postType === "photo") {
      // Check if image is square; if not, show cropper
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        if (img.width === img.height) {
          setFile(f);
          setPreview(url);
          setShowCropper(false);
        } else {
          setRawImageSrc(url);
          setShowCropper(true);
        }
      };
      img.src = url;
    } else {
      if (!f.name.match(/\.(mp3|wav)$/i)) {
        toast({ title: "Only .mp3 and .wav files are accepted", variant: "destructive" });
        return;
      }
      // Trim audio to 60 seconds if needed
      try {
        const trimmed = await trimAudioToSeconds(f, 60);
        setFile(trimmed);
      } catch {
        setFile(f);
      }
      setPreview(null);
    }
  }, [postType, toast]);

  const handleCropDone = useCallback((croppedFile: File) => {
    setFile(croppedFile);
    setPreview(URL.createObjectURL(croppedFile));
    setShowCropper(false);
    setRawImageSrc(null);
  }, []);

  const handleCropCancel = useCallback(() => {
    setShowCropper(false);
    setRawImageSrc(null);
  }, []);

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: `Please attach a ${postType} file`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const alreadyPosted = await hasPostedToday(userId, postType);
      if (alreadyPosted) {
        toast({ title: `You've already posted a ${postType} today. Come back tomorrow!`, variant: "destructive" });
        setLoading(false);
        return;
      }

      let lat: number | undefined;
      let lon: number | undefined;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch {
        // Geolocation failed — post without coords
      }

      await createPost({
        userId,
        type: postType,
        file,
        caption,
        latitude: lat,
        longitude: lon,
        tag: postType === "audio" ? audioTag : undefined,
      });

      toast({ title: "Your arc has been traced to the globe ✨" });
      onPostCreated();
      resetForm();
      onClose();
    } catch (err: any) {
      toast({ title: err.message || "Failed to post", variant: "destructive" });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setRawImageSrc(null);
    setShowCropper(false);
    setCaption("");
    setAudioTag("MUSIC");
  };

  return (
    <div
      className="fixed inset-y-0 left-0 z-[80] w-[340px] max-w-[90vw] p-8 overflow-y-auto transition-transform duration-500"
      style={{
        transform: open ? "translateX(0)" : "translateX(-100%)",
        background: "hsla(36,24%,94%,0.97)",
        borderRight: "1px solid hsl(0 0% 10% / 0.09)",
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground text-base"
      >
        ✕
      </button>

      <h2 className="text-2xl font-light italic mb-1">Today's moment</h2>
      <p className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-muted-foreground mb-6">
        One post · Once a day · Placed on the globe
      </p>

      {/* Type toggle */}
      <div className="flex mb-5 border rounded-sm overflow-hidden" style={{ borderColor: "hsl(0 0% 10% / 0.12)" }}>
        <button
          className={`flex-1 py-2 font-mono text-[0.58rem] tracking-[0.1em] uppercase border-none cursor-pointer transition-all ${
            postType === "photo" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"
          }`}
          onClick={() => { setPostType("photo"); setFile(null); setPreview(null); setShowCropper(false); setRawImageSrc(null); }}
        >
          📷 Photo
        </button>
        <button
          className={`flex-1 py-2 font-mono text-[0.58rem] tracking-[0.1em] uppercase border-none cursor-pointer transition-all ${
            postType === "audio" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"
          }`}
          onClick={() => { setPostType("audio"); setFile(null); setPreview(null); setShowCropper(false); setRawImageSrc(null); }}
        >
          🎙 Audio
        </button>
      </div>

      {/* File upload / Cropper */}
      {showCropper && rawImageSrc ? (
        <div className="mb-5">
          <ImageCropper imageSrc={rawImageSrc} onCropDone={handleCropDone} onCancel={handleCropCancel} />
        </div>
      ) : (
        <div
          className="w-full border-dashed border-[1.5px] rounded-sm flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors hover:border-primary hover:text-primary mb-5 relative overflow-hidden"
          style={{
            aspectRatio: postType === "photo" ? "1/1" : "16/9",
            borderColor: "hsl(0 0% 10% / 0.18)",
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept={postType === "photo" ? "image/*" : ".mp3,.wav"}
            onChange={handleFileChange}
            className="hidden"
          />
          {preview && postType === "photo" ? (
            <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
          ) : file && postType === "audio" ? (
            <div className="text-center">
              <span className="text-2xl">🎵</span>
              <p className="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-muted-foreground mt-1">{file.name}</p>
            </div>
          ) : (
            <>
              <span className="text-xl">↑</span>
              <span className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-muted-foreground">
                {postType === "photo" ? "Tap to upload photo" : "Tap to upload .mp3 or .wav"}
              </span>
            </>
          )}
        </div>
      )}

      {/* Audio tag selector */}
      {postType === "audio" && (
        <div className="mb-5">
          <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
            Tag
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {AUDIO_TAGS.map((tag) => (
              <button
                key={tag}
                className={`font-mono text-[0.52rem] tracking-[0.1em] uppercase px-3 py-1.5 rounded-sm border transition-all ${
                  audioTag === tag ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                }`}
                style={audioTag !== tag ? { borderColor: "hsl(0 0% 10% / 0.12)" } : {}}
                onClick={() => setAudioTag(tag)}
              >
                [{tag}]
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Caption */}
      <div className="mb-5">
        <label className="block font-mono text-[0.58rem] tracking-[0.12em] uppercase text-muted-foreground mb-2">
          Caption (optional)
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="A few words about this moment…"
          className="w-full bg-foreground/[0.04] border rounded-sm px-3.5 py-2.5 font-serif text-base text-foreground outline-none transition-colors focus:border-primary resize-none h-20 leading-relaxed"
          style={{ borderColor: "hsl(0 0% 10% / 0.12)" }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2.5 justify-end">
        <button
          onClick={() => { resetForm(); onClose(); }}
          className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm border transition-all hover:border-primary hover:text-primary"
          style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="font-mono text-[0.63rem] tracking-[0.12em] uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground transition-all hover:bg-primary-light disabled:opacity-50"
        >
          {loading ? "Posting..." : "Post to globe"}
        </button>
      </div>
    </div>
  );
}
