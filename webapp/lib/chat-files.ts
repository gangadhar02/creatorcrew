export type ChatAttachment = {
  name: string;
  mimeType: string;
  dataBase64: string;
};

/** Read picked files into base64 attachments for the chat API (inline to Gemini). */
export async function filesToAttachments(
  files: File[]
): Promise<ChatAttachment[]> {
  return Promise.all(
    files.map(
      (f) =>
        new Promise<ChatAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              name: f.name,
              mimeType: f.type || "application/octet-stream",
              dataBase64: ((reader.result as string) || "").split(",")[1] || "",
            });
          reader.onerror = reject;
          reader.readAsDataURL(f);
        })
    )
  );
}
