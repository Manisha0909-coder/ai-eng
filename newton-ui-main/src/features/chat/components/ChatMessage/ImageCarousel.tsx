import { Download, Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import notify from "@/utils/notify";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { fileUrl } from "@/utils/fileStaticPath";
import { getFetchUrlForImage } from "./utils";
import AuthenticatedImage from "./AuthenticatedImage";

interface CarouselImage {
  image_id?: string;
  image_name?: string;
  static_path: string;
  file_url?: string;
  tool_name?: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  /** Used as part of the reset key to clear state when message changes */
  messageId: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, messageId }) => {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageModalIndex, setImageModalIndex] = useState(0);
  const [imageModalApi, setImageModalApi] = useState<CarouselApi>();
  const [imageDimensions, setImageDimensions] = useState<{
    [key: string]: { width: number; height: number };
  }>({});
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(
    null,
  );

  // Build full image URL for display or download (static_path may be relative or absolute; file_url is full URL from API)
  const getImageDownloadUrl = useCallback(
    (img: { static_path?: string; file_url?: string }) => {
      const raw = img.file_url || img.static_path || "";
      if (!raw) return "";
      return fileUrl(raw);
    },
    [],
  );

  const handleDownloadImage = useCallback(
    async (img: {
      image_id: string;
      image_name?: string;
      static_path: string;
      file_url?: string;
    }) => {
      const id = img.image_id || img.static_path;
      setDownloadingImageId(id);
      try {
        const url = getImageDownloadUrl(img);
        const fetchUrl = getFetchUrlForImage(url);
        const response = await fetch(fetchUrl, { credentials: "include" });
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const filename =
          img.image_name ||
          url.split("/").pop()?.split("?")[0] ||
          "image.jpg";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      } catch (err) {
        notify.error("Failed to download image");
      } finally {
        setDownloadingImageId(null);
      }
    },
    [getImageDownloadUrl],
  );

  // Update current index when carousel changes
  useEffect(() => {
    if (!carouselApi) return;

    // Set initial index
    setCurrentImageIndex(carouselApi.selectedScrollSnap());

    // Listen for changes
    const onSelect = () => {
      setCurrentImageIndex(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);

    // Cleanup
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  // Reset carousel when message changes
  useEffect(() => {
    if (carouselApi) {
      carouselApi.scrollTo(0, true); // true = instant, no animation
      setCurrentImageIndex(0);
    }
    // Clear image dimensions when message changes
    setImageDimensions({});
  }, [messageId, images.length, carouselApi]);

  // Sync modal carousel index
  useEffect(() => {
    if (!imageModalApi) return;
    const onSelect = () =>
      setImageModalIndex(imageModalApi.selectedScrollSnap());
    onSelect();
    imageModalApi.on("select", onSelect);
    return () => {
      imageModalApi.off("select", onSelect);
    };
  }, [imageModalApi]);

  useEffect(() => {
    if (isImageModalOpen && imageModalApi) {
      imageModalApi.scrollTo(imageModalIndex, true);
    }
  }, [isImageModalOpen, imageModalIndex, imageModalApi]);

  if (!images || images.length === 0) return null;

  return (
    <div className="mt-4 ">
      <Carousel
        setApi={setCarouselApi}
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full max-w-[280px] sm:max-w-[500px] md:max-w-[700px] lg:max-w-[900px] xl:max-w-[1100px]"
      >
        x{" "}
        <div className="relative rounded-xl overflow-visible ">
          {/* Professional gallery layout with aspect ratio preservation */}
          <div className="relative w-full">
            <CarouselContent className="h-full ml-2 mr-2 sm:ml-4 sm:mr-4">
              {images.map((img, idx) => (
                <CarouselItem
                  key={img.image_id || idx}
                  className="h-full basis-auto flex-shrink-0"
                >
                  <div className="h-full flex items-center justify-center px-1">
                    {/* Aspect ratio preserved container */}
                    <div
                      className="h-32 sm:h-36 md:h-40 lg:h-44 xl:h-48 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800/30 to-gray-900/50 backdrop-blur-sm border border-border-main/50 flex items-center justify-center cursor-zoom-in hover:scale-105 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
                      style={{
                        width: imageDimensions[img.image_id || idx]?.width
                          ? `${Math.max(
                              Math.min(
                                imageDimensions[img.image_id || idx].width,
                                280,
                              ),
                              100,
                            )}px`
                          : "120px",
                        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        minWidth: "100px",
                        maxWidth: "280px",
                      }}
                      onClick={() => {
                        setImageModalIndex(idx);
                        setIsImageModalOpen(true);
                      }}
                    >
                      <AuthenticatedImage
                        src={img.static_path}
                        alt={img.image_name || `Generated image ${idx + 1}`}
                        className="h-full w-full object-contain"
                        staticPath={img.static_path}
                        onLoad={(e: any) => {
                          const imageElement = e.target as HTMLImageElement;
                          const naturalWidth = imageElement.naturalWidth;
                          const naturalHeight = imageElement.naturalHeight;
                          const containerHeight =
                            globalThis.innerWidth >= 640 ? 144 : 128; // h-36 or h-32

                          if (
                            naturalWidth &&
                            naturalHeight &&
                            naturalWidth > 0 &&
                            naturalHeight > 0
                          ) {
                            // Calculate aspect ratio and new width
                            const aspectRatio =
                              naturalWidth / naturalHeight;
                            const calculatedWidth =
                              aspectRatio * containerHeight;

                            // Store dimensions with bounds checking
                            setImageDimensions((prev) => ({
                              ...prev,
                              [img.image_id || idx]: {
                                width: calculatedWidth,
                                height: containerHeight,
                                aspectRatio: aspectRatio,
                              } as any,
                            }));
                          }
                        }}
                      />

                      {/* Image info overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-stretch justify-between p-2">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(img as any);
                            }}
                            disabled={
                              downloadingImageId ===
                              (img.image_id || img.static_path)
                            }
                            className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-60"
                            title="Download image"
                          >
                            {downloadingImageId ===
                            (img.image_id || img.static_path) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <div className="text-white text-xs">
                          <div className="font-medium truncate">
                            {img.image_name || `Image ${idx + 1}`}
                          </div>
                          {img.tool_name && (
                            <div className="text-gray-300 text-2xs truncate">
                              {img.tool_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Navigation Buttons */}
            {images.length > 3 && (
              <>
                <CarouselPrevious className="left-0 sm:left-1 bg-black/60 hover:bg-white/80 border-none text-white backdrop-blur-sm h-6 w-6 sm:h-8 sm:w-8 z-50" />
                <CarouselNext className="right-0 sm:-right-5 bg-black/60 hover:bg-white/80 border-none text-white backdrop-blur-sm h-6 w-6 sm:h-8 sm:w-8 z-50" />
              </>
            )}

            {/* Counter */}
            {images.length > 3 && (
              <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-2xs font-medium z-10">
                {Math.min(currentImageIndex + 1, images.length)} /{" "}
                {images.length}
              </div>
            )}
          </div>
        </div>
      </Carousel>
      {/* Fullscreen image viewer */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-6xl w-[96%] h-[86vh] p-0 bg-black/95">
          <div className="relative w-full h-full">
            <Carousel
              setApi={setImageModalApi}
              opts={{
                align: "center",
                loop: true,
                startIndex: imageModalIndex,
              }}
              className="w-full h-full"
            >
              <div className="relative w-full h-full">
                <CarouselContent className="h-full">
                  {images.map((img, idx) => (
                    <CarouselItem
                      key={img.image_id || idx}
                      className="h-full"
                    >
                      <div
                        className="h-screen w-full flex items-center justify-center bg-black cursor-pointer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: "100%",
                          minWidth: "100%",
                        }}
                        onClick={() => setIsImageModalOpen(false)}
                      >
                        <div
                          style={{
                            display: "block",
                            margin: "auto",
                            position: "relative",
                          }}
                        >
                          <AuthenticatedImage
                            src={img.static_path}
                            alt={img.image_name || `Image ${idx + 1}`}
                            className="max-w-[95%] max-h-[82vh] w-auto h-auto object-contain"
                            staticPath={img.static_path}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(img as any);
                            }}
                            disabled={
                              downloadingImageId ===
                              (img.image_id || img.static_path)
                            }
                            className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors disabled:opacity-60"
                            title="Download image"
                          >
                            {downloadingImageId ===
                            (img.image_id || img.static_path) ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Download className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-4 bg-white/10 hover:bg-white/20 border-white/30 text-white backdrop-blur-sm h-10 w-10" />
                    <CarouselNext className="right-4 bg-white/10 hover:bg-white/20 border-white/30 text-white backdrop-blur-sm h-10 w-10" />
                  </>
                )}
                {/* <div className="absolute top-3 right-3 bg-white/10 text-white px-3 py-1 rounded-full text-xs">
                  {Math.min(imageModalIndex + 1, images.length)} / {images.length}
                </div> */}
              </div>
            </Carousel>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageCarousel;
