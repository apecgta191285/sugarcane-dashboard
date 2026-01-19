import { UploadDropzone } from "@/features/upload/components/upload-dropzone";

export default function UploadPage() {
    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Upload Receipt
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
                Upload a sugarcane transaction receipt for OCR processing
            </p>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <UploadDropzone />
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    📸 Tips for best OCR results:
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                    <li>Ensure the receipt is well-lit and in focus</li>
                    <li>Capture the entire receipt in the frame</li>
                    <li>Avoid shadows and glare</li>
                    <li>Use high-resolution images when possible</li>
                </ul>
            </div>
        </div>
    );
}
