/**
 * Credit Calculator for Content Unlocking
 * 
 * Formula: KSH 100 = 50 credits
 * Example: KSH 200 content = 100 credits required
 */

/**
 * Calculate credits required to unlock content based on its KES price
 * @param kesPrice - The price of content in Kenyan Shillings (KES)
 * @returns The number of credits required (always rounded up to ensure fairness)
 */
export function calculateCreditsRequired(kesPrice: number): number {
  if (kesPrice <= 0) return 0;
  
  // KSH 100 = 50 credits
  // Formula: (kesPrice / 100) * 50
  const credits = (kesPrice / 100) * 50;
  
  // Round up to ensure users have enough credits
  return Math.ceil(credits);
}

/**
 * Calculate the KES equivalent of a given amount of credits
 * @param credits - The number of credits
 * @returns The equivalent value in KES
 */
export function calculateKesFromCredits(credits: number): number {
  if (credits <= 0) return 0;
  
  // 50 credits = KSH 100
  // Formula: (credits / 50) * 100
  return (credits / 50) * 100;
}

/**
 * Check if user has sufficient credits to unlock content
 * @param userCredits - User's current credit balance
 * @param kesPrice - The price of content in KES
 * @returns boolean indicating if user has enough credits
 */
export function hasEnoughCreditsForUnlock(userCredits: number, kesPrice: number): boolean {
  const creditsRequired = calculateCreditsRequired(kesPrice);
  return userCredits >= creditsRequired;
}
