import {hydrogenPreset} from '@shopify/hydrogen/react-router-preset';
import type {Config} from '@react-router/dev/config';

/**
 * React Router 7.9.x Configuration for Hydrogen
 *
 * This configuration uses the official Hydrogen preset to provide optimal
 * React Router settings for Shopify Oxygen deployment. The preset enables
 * validated performance optimizations while ensuring compatibility.
 */
export default {
  presets: [hydrogenPreset()],
} satisfies Config;
