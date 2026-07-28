import { useEffect, useState } from 'react';
import api from '../../services/api/axiosConfig';

/**
 * Renders an <img> backed by a PRIVATE, authenticated backend endpoint (payment evidence,
 * quick-request attachments, KYC documents) rather than a plain publicly-fetchable URL. A bare
 * <img src="..."> can't send the app's Bearer token, so this component fetches the image via the
 * shared axios instance and renders it as a local Blob URL instead.
 */
export function PrivateImage({
  apiPath,
  alt,
  className,
  onClick,
}: {
  apiPath: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setBlobUrl(null);
    setFailed(false);

    const relativePath = apiPath.replace(/^\/api(?=\/)/, '');
    api
      .get(relativePath, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data as Blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiPath]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 text-xs ${className ?? ''}`}>
        Unavailable
      </div>
    );
  }

  if (!blobUrl) {
    return <div className={`animate-pulse bg-slate-200 ${className ?? ''}`} />;
  }

  return <img src={blobUrl} alt={alt} className={className} onClick={onClick} />;
}
