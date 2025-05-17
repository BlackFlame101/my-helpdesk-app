"use client";

import { useState, useEffect } from 'react';

interface ClientOnlyDateProps {
  dateString: string | undefined | null;
  options?: Intl.DateTimeFormatOptions;
  placeholder?: string;
}

const ClientOnlyDateTime: React.FC<ClientOnlyDateProps> = ({
  dateString,
  options,
  placeholder,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!dateString) {
    return <span>{placeholder || ''}</span>;
  }

  const hasTimeOptions = options && (
    options.timeStyle || options.hour || options.minute || options.second
  );

  if (!mounted) {
    // Render placeholder on server and initial client render
    const placeholderDate = new Date(dateString).toISOString().split('T')[0];
    return <span>{placeholder === undefined ? placeholderDate : placeholder}</span>;
  }

  try {
    const date = new Date(dateString);
    // Use toLocaleString if time options are provided, otherwise use toLocaleDateString
    const formattedDate = hasTimeOptions
      ? date.toLocaleString(undefined, options)
      : date.toLocaleDateString(undefined, options);
    return <span>{formattedDate}</span>;
  } catch (e) {
    console.error("Error formatting date/time:", e);
    return <span>Invalid Date</span>; // Fallback for invalid date strings
  }
};
// --- End of ClientOnlyDateTime Component ---

export default ClientOnlyDateTime;