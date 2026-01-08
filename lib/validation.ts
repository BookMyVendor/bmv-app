/**
 * Validation utility functions for the application
 */

/**
 * Validates an email address with strict rules for public providers.
 * 
 * Rules:
 * - Gmail: must be gmail.com or gmail.co.in
 * - Yahoo: must be yahoo.com, yahoo.in, yahoo.co.uk, or yahoo.co.in
 * - Microsoft (Outlook/Hotmail/Live): must be .com
 * - Company/Others: Standard name@domain.tld or name@domain.co.in
 * 
 * @param email The email address to validate
 * @returns boolean true if valid, false otherwise
 */
export const validateEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    const trimmed = email.trim().toLowerCase();

    // Basic structure check
    const basicRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!basicRegex.test(trimmed)) return false;

    const parts = trimmed.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];

    // Gmail specific
    if (domain.startsWith('gmail.')) {
        return domain === 'gmail.com' || domain === 'gmail.co.in';
    }

    // Yahoo specific
    if (domain.startsWith('yahoo.')) {
        const validYahoo = ['yahoo.com', 'yahoo.in', 'yahoo.co.uk', 'yahoo.co.in'];
        return validYahoo.includes(domain);
    }

    // Microsoft specific
    if (domain.startsWith('outlook.') || domain.startsWith('hotmail.') || domain.startsWith('live.')) {
        return domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com';
    }

    // Reject known bad patterns like .co if they look like a typo for .com for these providers
    // (Already handled by the specific checks above)

    return true;
};

/**
 * Gets a descriptive error message for an invalid email.
 * Useful for real-time validation feedback.
 */
export const getEmailError = (email: string | null | undefined): string | null => {
    if (!email || !email.trim()) return 'Email is required';
    const trimmed = email.trim().toLowerCase();

    const basicRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!basicRegex.test(trimmed)) return 'Please enter a valid email address';

    const parts = trimmed.split('@');
    const domain = parts[1];

    if (domain.startsWith('gmail.')) {
        if (domain !== 'gmail.com' && domain !== 'gmail.co.in') {
            return 'Invalid Gmail domain. Use gmail.com or gmail.co.in';
        }
    }

    if (domain.startsWith('yahoo.')) {
        const validYahoo = ['yahoo.com', 'yahoo.in', 'yahoo.co.uk', 'yahoo.co.in'];
        if (!validYahoo.includes(domain)) {
            return 'Invalid Yahoo domain';
        }
    }

    if (domain.startsWith('outlook.') || domain.startsWith('hotmail.') || domain.startsWith('live.')) {
        if (!['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) {
            return 'Invalid domain for this provider';
        }
    }

    return null;
};

/**
 * Basic Email Regex constant for use in other validation libraries like Yup
 * Note: This doesn't include the strict provider rules. 
 * For those, use Yup's .test() method with validateEmail.
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
