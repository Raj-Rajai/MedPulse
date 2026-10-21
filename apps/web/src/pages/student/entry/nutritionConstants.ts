/**
 * Fixed nutrition reference constants from healthy macros form (healthy macros.pdf, pp. 45-46).
 * DO NOT modify these constants.
 */

export interface FoodItemDef {
    id: string;
    category: string;
    name: string;
    kcalPer100g: number;
    proteinPer100g: number;
}

export const FOOD_ITEMS: readonly FoodItemDef[] = [
    // Cereals
    { id: 'cereal_wheat', category: 'Cereals', name: 'Wheat', kcalPer100g: 350, proteinPer100g: 11 },
    { id: 'cereal_rice', category: 'Cereals', name: 'Rice', kcalPer100g: 350, proteinPer100g: 7 },
    { id: 'cereal_jowar', category: 'Cereals', name: 'Jowar', kcalPer100g: 350, proteinPer100g: 10 },
    { id: 'cereal_maize', category: 'Cereals', name: 'Maize', kcalPer100g: 340, proteinPer100g: 11 },
    { id: 'cereal_bajra', category: 'Cereals', name: 'Bajra', kcalPer100g: 360, proteinPer100g: 11 },

    // Pulses
    { id: 'pulse_red_gram', category: 'Pulses', name: 'Red gram', kcalPer100g: 335, proteinPer100g: 20 },
    { id: 'pulse_green_gram', category: 'Pulses', name: 'Green gram', kcalPer100g: 350, proteinPer100g: 25 },
    { id: 'pulse_bengal_gram', category: 'Pulses', name: 'Bengal gram', kcalPer100g: 360, proteinPer100g: 15 },
    { id: 'pulse_black_gram', category: 'Pulses', name: 'Black gram', kcalPer100g: 350, proteinPer100g: 25 },
    { id: 'pulse_soyabean', category: 'Pulses', name: 'Soyabean', kcalPer100g: 430, proteinPer100g: 40 },

    // Vegetables
    { id: 'veg_leafy', category: 'Vegetables', name: 'Green leafy vegetables', kcalPer100g: 30, proteinPer100g: 4 },
    { id: 'veg_tubers', category: 'Vegetables', name: 'Roots and tubers (Potato)', kcalPer100g: 70, proteinPer100g: 1 },

    // Oil and nuts
    { id: 'oil_oil', category: 'Oil and nuts', name: 'Oil', kcalPer100g: 900, proteinPer100g: 0 },
    { id: 'oil_ghee', category: 'Oil and nuts', name: 'Ghee', kcalPer100g: 900, proteinPer100g: 0 },

    // Milk and products
    { id: 'milk_milk', category: 'Milk and products', name: 'Milk', kcalPer100g: 117, proteinPer100g: 4 },
    { id: 'milk_curd', category: 'Milk and products', name: 'Curd', kcalPer100g: 60, proteinPer100g: 3 },
    { id: 'milk_chass', category: 'Milk and products', name: 'Chass/Buttermilk', kcalPer100g: 30, proteinPer100g: 2 },
    { id: 'milk_butter', category: 'Milk and products', name: 'Butter', kcalPer100g: 0, proteinPer100g: 0 },
    { id: 'milk_tea', category: 'Milk and products', name: 'Tea', kcalPer100g: 80, proteinPer100g: 1 },
    { id: 'milk_coffee', category: 'Milk and products', name: 'Coffee', kcalPer100g: 100, proteinPer100g: 2 },
    { id: 'milk_human', category: 'Milk and products', name: 'Human milk', kcalPer100g: 65, proteinPer100g: 3.5 },

    // Sugar and jaggery
    { id: 'sugar_sugar', category: 'Sugar and jaggery', name: 'Sugar', kcalPer100g: 400, proteinPer100g: 0 },
    { id: 'sugar_jaggery', category: 'Sugar and jaggery', name: 'Jaggery', kcalPer100g: 400, proteinPer100g: 0.5 },

    // Non-veg
    { id: 'nonveg_egg', category: 'Non-veg', name: 'Egg (pc)', kcalPer100g: 60, proteinPer100g: 6 },
    { id: 'nonveg_fish', category: 'Non-veg', name: 'Fish', kcalPer100g: 100, proteinPer100g: 20 },
    { id: 'nonveg_meat', category: 'Non-veg', name: 'Meat', kcalPer100g: 100, proteinPer100g: 20 },

    // Fruits
    { id: 'fruit_banana', category: 'Fruits', name: 'Banana', kcalPer100g: 100, proteinPer100g: 1 },
    { id: 'fruit_mango', category: 'Fruits', name: 'Mango', kcalPer100g: 70, proteinPer100g: 1 },
    { id: 'fruit_apple', category: 'Fruits', name: 'Apple', kcalPer100g: 50, proteinPer100g: 1 },
    { id: 'fruit_chikoo', category: 'Fruits', name: 'Chikoo', kcalPer100g: 50, proteinPer100g: 1 },

    // Snacks
    { id: 'snack_bread', category: 'Snacks', name: 'Bread (pc)', kcalPer100g: 50, proteinPer100g: 11 },
    { id: 'snack_biscuit', category: 'Snacks', name: 'Biscuit (pc)', kcalPer100g: 30, proteinPer100g: 1 },
    { id: 'snack_khari', category: 'Snacks', name: 'Khari', kcalPer100g: 50, proteinPer100g: 1 },
    { id: 'snack_farsan', category: 'Snacks', name: 'Farsan', kcalPer100g: 150, proteinPer100g: 4 },
    { id: 'snack_ground_nuts', category: 'Snacks', name: 'Ground nuts', kcalPer100g: 350, proteinPer100g: 25 },
    { id: 'snack_bengal_gram', category: 'Snacks', name: 'Bengal gram (Chana)', kcalPer100g: 350, proteinPer100g: 15 },
];

export interface NutritionItemResult {
    quantityDay: number;
    quantityMonth: number;
    kcal: number;
    protein: number;
}

/**
 * Calculates monthly quantity, kcal, and protein from daily intake in grams.
 * Formulas specified in Master Prompt Section 45:
 *   quantityMonth = quantityDay * 30
 *   kcal = (quantityDay / 100) * kcalPer100g
 *   protein = (quantityDay / 100) * proteinPer100g
 */
export function calculateNutritionRow(quantityDay: number, item: FoodItemDef): NutritionItemResult {
    const qDay = Math.max(0, quantityDay || 0);
    const quantityMonth = qDay * 30;
    const kcal = (qDay / 100) * item.kcalPer100g;
    const protein = (qDay / 100) * item.proteinPer100g;
    return {
        quantityDay: qDay,
        quantityMonth: parseFloat(quantityMonth.toFixed(2)),
        kcal: parseFloat(kcal.toFixed(2)),
        protein: parseFloat(protein.toFixed(2)),
    };
}
