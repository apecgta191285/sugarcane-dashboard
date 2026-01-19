"use client";

import { useState, useCallback, useTransition } from "react";
import { Upload, X, Loader2, CheckCircle } from "lucide-react";
import { uploadReceipt } from "../actions/upload";

export function UploadDropzone() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Handle file selection
    const handleFileChange = useCallback((selectedFile: File | null) => {
        if (!selectedFile) {
            setFile(null);
            setPreview(null);
            return;
        }

        // Validate file type
        if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(selectedFile.type)) {
            setError("Only JPEG, PNG, and WebP images are allowed");
            return;
        }

        // Validate file size (5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError("File size must be less than 5MB");
            return;
        }

        setError(null);
        setFile(selectedFile);

        // Generate preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
    }, []);

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile) {
                handleFileChange(droppedFile);
            }
        },
        [handleFileChange]
    );

    // Submit upload
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError("Please select a file");
            return;
        }

        setError(null);
        setSuccess(false);

        const formData = new FormData();
        formData.append("file", file);

        startTransition(async () => {
            const result = await uploadReceipt(formData);

            if (result.success) {
                setSuccess(true);
                setFile(null);
                setPreview(null);

                // Auto-clear success message after 3 seconds
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(result.error);
            }
        });
    };

    // Clear file
    const clearFile = () => {
        setFile(null);
        setPreview(null);
        setError(null);
        setSuccess(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dropzone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${isDragging
                        ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
            >
                {preview ? (
                    // Preview
                    <div className="relative">
                        <img
                            src={preview}
                            alt="Preview"
                            className="max-h-96 mx-auto rounded-lg"
                        />
                        <button
                            type="button"
                            onClick={clearFile}
                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    // Upload prompt
                    <div className="text-center">
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                            Drag and drop your receipt image here, or{" "}
                            <label className="text-green-600 dark:text-green-400 underline cursor-pointer">
                                browse
                                <input
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            Max file size: 5MB • Formats: JPEG, PNG, WebP
                        </p>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Success Message */}
            {success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-600 dark:text-green-400">
                        Receipt uploaded successfully!
                    </p>
                </div>
            )}

            {/* Submit Button */}
            {file && (
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Upload className="w-5 h-5" />
                            Upload Receipt
                        </>
                    )}
                </button>
            )}
        </form>
    );
}
