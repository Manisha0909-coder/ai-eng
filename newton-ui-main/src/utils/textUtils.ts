/**
 * Checks if the first 10 characters of a text are Arabic
 * @param text - The text to check
 * @returns true if the first 10 characters are Arabic, false otherwise
 */
export function isArabicFirst10(text: string): boolean {
  const first10 = text.slice(0, 10);


  const cleaned = first10.replace(/[^\u0600-\u06FF\s]/g, '');


  const arabicRegex = /^[\u0600-\u06FF\s]{1,10}$/;

  // Must match regex AND contain at least one Arabic letter
  const containsArabic = /[\u0600-\u06FF]/.test(cleaned);
  const result = arabicRegex.test(cleaned) && containsArabic;


  return result;
}



/**
 * Checks if a text contains Arabic characters
 * @param text - The text to check
 * @returns true if the text contains Arabic characters, false otherwise
 */
export function containsArabic(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF]/;
  return arabicRegex.test(text);
}

/**
 * Determines the text direction based on the content
 * @param text - The text to analyze
 * @returns 'rtl' for Arabic text, 'ltr' for other text
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' {
  return isArabicFirst10(text) ? 'rtl' : 'ltr';
}

/**
 * Gets the appropriate CSS class for text direction
 * @param text - The text to analyze
 * @returns CSS class string for text direction
 */
export function getTextDirectionClass(text: string): string {
  return isArabicFirst10(text) ? 'text-right' : 'text-left';
}

/**
 * Extracts formatted text content from a DOM element
 * @param element - The DOM element to extract text from
 * @returns Formatted text content
 */
export function extractFormattedText(element: HTMLElement): string {
  if (!element) {
    return '';
  }

  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove any copy buttons or other UI elements
  const copyButtons = clone.querySelectorAll('[class*="copy"], [class*="Copy"]');
  copyButtons.forEach(btn => btn.remove());

  // Function to process table elements
  const processTable = (table: HTMLTableElement): string => {
    const rows = Array.from(table.querySelectorAll('tr'));
    const processedRows: string[] = [];
    
    if (rows.length === 0) return '';
    
    // Get all cells to determine column widths
    const columnCount = Math.max(...rows.map(row => row.querySelectorAll('th, td').length));
    
    // Calculate column widths based on content
    const columnWidths: number[] = [];
    for (let i = 0; i < columnCount; i++) {
      let maxWidth = 0;
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        if (cells[i]) {
          const cellText = cells[i].textContent?.trim() || '';
          maxWidth = Math.max(maxWidth, cellText.length);
        }
      });
      columnWidths[i] = maxWidth;
    }
    
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      const cellTexts = cells.map(cell => cell.textContent?.trim() || '');
      
      if (rowIndex === 0) {
        // Header row with top border
        const headerRow = '| ' + cellTexts.map((text, index) => {
          const width = columnWidths[index] || text.length;
          return text.padEnd(width);
        }).join(' | ') + ' |';
        processedRows.push(headerRow);
        
        // Add separator line with borders
        const separator = '| ' + columnWidths.map(width => '-'.repeat(width)).join(' | ') + ' |';
        processedRows.push(separator);
      } else {
        // Data rows with borders
        const dataRow = '| ' + cellTexts.map((text, index) => {
          const width = columnWidths[index] || text.length;
          return text.padEnd(width);
        }).join(' | ') + ' |';
        processedRows.push(dataRow);
      }
    });
    
    return processedRows.join('\n');
  };

  // Function to process list elements
  const processList = (list: HTMLUListElement | HTMLOListElement): string => {
    const items = Array.from(list.querySelectorAll('li'));
    const isOrdered = list.tagName === 'OL';
    
    return items.map((item, index) => {
      const prefix = isOrdered ? `${index + 1}.` : '•';
      return `${prefix} ${item.textContent?.trim() || ''}`;
    }).join('\n');
  };

  // Function to process blockquote elements
  const processBlockquote = (blockquote: HTMLQuoteElement): string => {
    const content = blockquote.textContent?.trim() || '';
    return content.split('\n').map(line => `> ${line}`).join('\n');
  };

  // Function to process code blocks
  const processCodeBlock = (pre: HTMLPreElement): string => {
    const code = pre.querySelector('code');
    const content = code?.textContent || pre.textContent || '';
    return content;
  };

  // Function to process inline code
  const processInlineCode = (code: HTMLElement): string => {
    return `\`${code.textContent?.trim() || ''}\``;
  };

  // Function to process links
  const processLink = (link: HTMLAnchorElement): string => {
    const text = link.textContent?.trim() || '';
    const href = link.getAttribute('href') || '';
    return href ? `[${text}](${href})` : text;
  };

  // Function to process headings
  const processHeading = (heading: HTMLHeadingElement): string => {
    const level = parseInt(heading.tagName.charAt(1));
    const text = heading.textContent?.trim() || '';
    const prefix = '#'.repeat(level);
    return `${prefix} ${text}`;
  };

  // Function to process paragraphs and other text elements
  const processTextElement = (element: HTMLElement): string => {
    let text = element.textContent?.trim() || '';
    
    // Handle bold text
    const boldElements = element.querySelectorAll('strong, b');
    boldElements.forEach(bold => {
      const boldText = bold.textContent?.trim() || '';
      text = text.replace(boldText, `**${boldText}**`);
    });

    // Handle italic text
    const italicElements = element.querySelectorAll('em, i');
    italicElements.forEach(italic => {
      const italicText = italic.textContent?.trim() || '';
      text = text.replace(italicText, `*${italicText}*`);
    });

    // Clean up extra whitespace and normalize line breaks
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  };

  // Process the cloned element
  const processElement = (el: HTMLElement): string => {
    const children = Array.from(el.childNodes);
    const results: string[] = [];

    children.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) results.push(text);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        
        switch (element.tagName.toLowerCase()) {
          case 'table':
            results.push(processTable(element as HTMLTableElement));
            break;
          case 'ul':
          case 'ol':
            results.push(processList(element as HTMLUListElement | HTMLOListElement));
            break;
          case 'blockquote':
            results.push(processBlockquote(element as HTMLQuoteElement));
            break;
          case 'pre':
            results.push(processCodeBlock(element as HTMLPreElement));
            break;
          case 'code':
            if (element.parentElement?.tagName.toLowerCase() !== 'pre') {
              results.push(processInlineCode(element));
            }
            break;
          case 'a':
            results.push(processLink(element as HTMLAnchorElement));
            break;
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            results.push(processHeading(element as HTMLHeadingElement));
            break;
          case 'p':
          case 'div':
            if (!element.querySelector('table, ul, ol, blockquote, pre, h1, h2, h3, h4, h5, h6')) {
              const text = processTextElement(element);
              if (text) results.push(text);
            }
            break;
          default:
            if (element.children.length === 0) {
              const text = element.textContent?.trim();
              if (text) results.push(text);
            } else {
              const text = processElement(element);
              if (text) results.push(text);
            }
        }
      }
    });

    // Filter out empty results and join with appropriate spacing
    const filteredResults = results.filter(Boolean);
    
    // Add extra spacing around tables and lists for better readability
    const formattedResults: string[] = [];
    filteredResults.forEach((result, index) => {
      const isTable = result.includes(' | ') && result.includes('-');
      const isList = result.includes('•') || /^\d+\./.test(result);
      const isHeading = result.startsWith('#');
      
      // Add spacing before tables, lists, and headings (except the first one)
      if (index > 0 && (isTable || isList || isHeading)) {
        formattedResults.push('');
      }
      
      formattedResults.push(result);
      
      // Add spacing after tables and lists
      if (isTable || isList) {
        formattedResults.push('');
      }
    });

    // Clean up the final result
    let finalResult = formattedResults.join('\n');
    
    // Remove excessive blank lines
    finalResult = finalResult.replace(/\n{3,}/g, '\n\n');
    
    return finalResult;
  };

  return processElement(clone);
}

/**
 * Copies text to clipboard with fallback support
 * @param text - The text to copy
 * @returns Promise that resolves to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Try the modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers or non-secure contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (error) {
    console.error('Failed to copy text to clipboard:', error);
    return false;
  }
} 