export class TextChunker {
    /**
     * Splits text into overlapping chunks of a given maximum length.
     * @param text The text to chunk
     * @param chunkSize Maximum length of a chunk (in characters)
     * @param overlap Number of characters to overlap between chunks
     * @returns Array of text chunks
     */
    static chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
        if (!text || text.trim() === "") return [];

        const chunks: string[] = [];
        let i = 0;

        while (i < text.length) {
            let end = i + chunkSize;

            // If we are not at the end of the text, try to find a natural break (newline or space)
            if (end < text.length) {
                // Try to find a newline within the last 10% of the chunk
                const lastNewline = text.lastIndexOf('\n', end);
                if (lastNewline > i + (chunkSize * 0.9)) {
                    end = lastNewline + 1;
                } else {
                    // Try to find a space
                    const lastSpace = text.lastIndexOf(' ', end);
                    if (lastSpace > i + (chunkSize * 0.8)) {
                        end = lastSpace + 1;
                    }
                }
            }

            chunks.push(text.slice(i, end).trim());
            
            // Advance by (chunkSize - overlap), but based on where we actually ended
            i = end - overlap;
            
            // Prevent infinite loop if overlap is too large or chunking gets stuck
            if (i <= 0 || end >= text.length) {
                break;
            }
        }

        // Filter out any empty chunks that might have been created
        return chunks.filter(c => c.length > 0);
    }
}
