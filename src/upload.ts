/**
 * Temporary file upload utilities for hosting files that need to be accessed via URL
 */

import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

/**
 * Upload a file to a temporary file hosting service
 * Uses 0x0.st which provides direct download URLs for files up to 512MB
 * Files are kept for up to 365 days depending on size
 *
 * @param filePath Absolute path to the file to upload
 * @returns Promise resolving to the public URL of the uploaded file
 */
export async function uploadFileTemporary(filePath: string): Promise<string> {
    const fileName = basename(filePath);
    const stats = statSync(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    console.log(`\nUploading ${fileName} (${fileSizeInMB.toFixed(2)} MB) to temporary hosting...`);

    // Read file into a buffer
    const fileBuffer = readFileSync(filePath);

    // Create form data with the file using Node.js built-in FormData
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: "audio/wav" });
    formData.append("file", blob, fileName);

    try {
        // Upload to 0x0.st
        const response = await fetch("https://0x0.st", {
            method: "POST",
            body: formData,
            headers: {
                "User-Agent": "Dolly/1.0",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Upload failed (${response.status}): ${errorText}`
            );
        }

        // The response is the URL as plain text
        const url = (await response.text()).trim();

        console.log(`Upload complete: ${url}`);
        return url;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to upload file: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Alternative upload service using file.io (files expire after 1 download or 14 days)
 * Uncomment to use this instead of 0x0.st
 */
/*
export async function uploadToFileIO(filePath: string): Promise<string> {
    const fileName = basename(filePath);
    console.log(`\nUploading ${fileName} to file.io...`);

    const fileStream = createReadStream(filePath);
    const chunks: Buffer[] = [];

    for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
    }

    const fileBuffer = Buffer.concat(chunks);
    const formData = new FormData();
    const file = new File([fileBuffer], fileName);
    formData.append("file", file);

    const response = await fetch("https://file.io", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json() as { success: boolean; link?: string; message?: string };

    if (!result.success || !result.link) {
        throw new Error(`Upload failed: ${result.message || "Unknown error"}`);
    }

    console.log(`Upload complete: ${result.link}`);
    return result.link;
}
*/
