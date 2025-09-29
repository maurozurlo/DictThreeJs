export const Tabs = {
    Menu: 'Menu',
    Log: 'Log',
    Meet: 'Meet',
    Laws: 'Laws',
    Deals: 'Deals',
    Budget: 'Budget',
    Shop: 'Shop',
    Street: 'Street',
    Secret: 'Secret'
} as const;

export type Tabs = typeof Tabs[keyof typeof Tabs];

export type TabProps = {
    isActive: boolean;
}