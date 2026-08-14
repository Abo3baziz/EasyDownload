import { useState } from 'react'

export interface MediaThumbnailProps {
  src?: string
  alt: string
  imgClassName?: string
  fallbackClassName?: string
}

export function MediaThumbnail({
  src,
  alt,
  imgClassName = 'download-thumbnail',
  fallbackClassName = 'download-thumbnail-fallback'
}: MediaThumbnailProps) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={fallbackClassName} aria-hidden="true">
        No thumbnail
      </div>
    )
  }
  return <img className={imgClassName} src={src} alt={alt} onError={() => setFailed(true)} />
}
