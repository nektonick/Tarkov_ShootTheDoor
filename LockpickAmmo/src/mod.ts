import { DependencyContainer } from "tsyringe";
// SPT types
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { IDatabaseTables } from "@spt-aki/models/spt/server/IDatabaseTables";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import { SecuredContainers } from "@spt-aki/models/enums/ContainerTypes"
import { LockpickAmmoModConfig, LockpickAmmoTemplate } from "./zod_types";
import ModConfig = require("../config/config.json");
import { ITemplateItem, Slot } from "@spt-aki/models/eft/common/tables/ITemplateItem";


class LockpickAmmoMod implements IPostDBLoadMod {
    private mod: string = "LockpickAmmo"
    private logger: null | ILogger = null
    private jsonUtil: null | JsonUtil = null
    private tables: null | IDatabaseTables = null

    /**
     * Majority of trader-related work occurs after the aki database has been loaded but prior to SPT code being run
     * @param container Dependency container
     */
    public postDBLoad(container: DependencyContainer): void {
        this.jsonUtil = container.resolve<JsonUtil>("JsonUtil");
        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        this.tables = databaseServer.getTables();
        this.logger = container.resolve<ILogger>("WinstonLogger");

        this.setupLockpickAmmo()
    }

    private setupLockpickAmmo(): void {
        const parsed_cfg = this.readConfig()
        for (const ammo_template of parsed_cfg.lockpick_ammo_mod.lockpick_ammo) {
            this.createNewAmmo(ammo_template);
        }
    }

    private readConfig(): LockpickAmmoModConfig {
        const parsed_cfg = LockpickAmmoModConfig.parse(ModConfig)
        return parsed_cfg
    }

    private createNewAmmo(new_ammo_template: LockpickAmmoTemplate): void {
        if (this.isItemAlreadyExists(new_ammo_template.id)) {
            this.logger!.warning(`[${this.mod}] id ${new_ammo_template.id} already exists`);
            return;
        }

        this.createItem(new_ammo_template)
        this.createItemLocale(new_ammo_template)
        this.addItemToHandbook(new_ammo_template)
        this.addItemToTraders(new_ammo_template)
        this.allowIntoSecureContainers(new_ammo_template.id)
        this.makeAmmoUsableWithWeapon(new_ammo_template);
    }

    private isItemAlreadyExists(id: string): boolean {
        const items = this.tables?.templates?.items
        if (items == undefined) {
            this.logger!.warning(`[${this.mod}] can't resolve items`);
            return false;
        }
        return id in items;
    }

    private createItem(new_ammo_template: LockpickAmmoTemplate) {
        const items = this.tables!.templates!.items;
        if (!(new_ammo_template.original_ammo_id in items)) {
            this.logger!.warning(`[${this.mod}] can't find base item ${new_ammo_template.original_ammo_id} in templates`);
            return;
        }
        const base_item = items[new_ammo_template.original_ammo_id]
        const new_item = this.jsonUtil!.clone(base_item);
        const props = new_item._props;
        const ammo_options = new_ammo_template.ammo_options;

        new_item._id = new_ammo_template.id;
        props.Damage = ammo_options.damage;
        props.ArmorDamage = ammo_options.armor_damage;
        props.PenetrationPower = ammo_options.penetration_power;
        props.PenetrationChance = ammo_options.penetration_chance;
        props.PenetrationPowerDiviation = ammo_options.penetration_power_diviation;
        props.MisfireChance = ammo_options.missfire_chance;
        props.MalfMisfireChance = ammo_options.malfunctioning_misfire_chance;
        props.MalfFeedChance = ammo_options.malfunctioning_feed_chance;
        props.DurabilityBurnModificator = ammo_options.durability_burn_modificator;
        props.BackgroundColor = ammo_options.backgound_color;

        this.tables!.templates!.items[new_ammo_template.id] = new_item;
    }

    private createItemLocale(new_ammo_template: LockpickAmmoTemplate) {
        const locales = Object.values(this.tables!.locales!.global) as Record<string, string>[];
        for (const locale of locales) {
            locale[`${new_ammo_template.id} Name`] = new_ammo_template.name;
            locale[`${new_ammo_template.id} ShortName`] = new_ammo_template.short_name;
            locale[`${new_ammo_template.id} Description`] = new_ammo_template.description;
        }
    }

    private addItemToHandbook(new_ammo_template: LockpickAmmoTemplate) {
        const handbook = this.tables!.templates!.handbook;
        const base_handbook_item = handbook.Items.find((item) => item.Id == new_ammo_template.original_ammo_id)
        if (base_handbook_item === undefined) {
            this.logger!.warning(`[${this.mod}] can't find base item ${new_ammo_template.original_ammo_id} in handbook`);
            return;
        }

        handbook.Items.push({
            Id: new_ammo_template.id,
            ParentId: base_handbook_item.ParentId,
            Price: new_ammo_template.price_in_handbook
        });
    }

    private addItemToTraders(new_ammo_template: LockpickAmmoTemplate) {
        for (const trader_options of new_ammo_template.traders_options) {
            if (!(trader_options.trader in this.tables!.traders!)) {
                this.logger!.warning(`[${this.mod}] can't find trader ${trader_options.trader}`);
                continue;
            }

            const trader = this.tables!.traders![trader_options.trader];
            const trader_assort = trader.assort;

            const PARENT_ID = "hideout" // tutorial says: Should always be "hideout"
            const SLOT_ID = "hideout"
            const newItem: Item = {
                "_id": new_ammo_template.id,
                "_tpl": new_ammo_template.id,
                "parentId": PARENT_ID,
                "slotId": SLOT_ID,
                "upd":
                {
                    "UnlimitedCount": false,
                    "StackObjectsCount": trader_options.count
                }
            }
            trader_assort.items.push(newItem);

            trader_assort.barter_scheme[new_ammo_template.id] = [
                [
                    {
                        "count": trader_options.price.value,
                        "_tpl": trader_options.price.currencie
                    }
                ]
            ];
            trader_assort.loyal_level_items[new_ammo_template.id] = trader_options.loyalty_level;
        }
    }

    private allowIntoSecureContainers(item_id: string): void {
        const items = this.tables?.templates?.items;
        for (const secure_container of [SecuredContainers.ALPHA, SecuredContainers.BETA, SecuredContainers.EPSILON, SecuredContainers.GAMMA, SecuredContainers.KAPPA]) {
            if (!(secure_container in items!)) {
                this.logger!.warning(`[${this.mod}] can't find container ${secure_container}`);
                continue;
            }

            const container_props = items![secure_container]._props;
            container_props.Grids![0]._props.filters[0].Filter.push(item_id)
        }
    }

    private makeAmmoUsableWithWeapon(new_ammo_template: LockpickAmmoTemplate) {
        const items = this.tables!.templates!.items!;
        for (const item_id in items) {
            this.processSingleItem(items[item_id], new_ammo_template)
        }
    }

    private processSingleItem(item_template: ITemplateItem, new_ammo_template: LockpickAmmoTemplate) {
        const slots = item_template._props.Slots;
        if (slots !== undefined) {
            this.processItemSlots(slots, new_ammo_template);
        }

        const chambers = item_template._props.Chambers;
        if (chambers !== undefined) {
            this.processItemChambers(chambers, new_ammo_template);
        }

        const cartridges = item_template._props.Cartridges!;
        if (cartridges !== undefined) {
            this.processItemCartridges(cartridges, new_ammo_template);
        }
    }

    private processItemSlots(slots: Slot[], new_ammo_template: LockpickAmmoTemplate) {
        for (const slot of slots) {
            const slot_allowed_items = slot._props.filters[0].Filter
            if (slot_allowed_items.includes(new_ammo_template.original_ammo_id)) {
                // Case 1: allowed item is original_ammo_id
                slot_allowed_items.push(new_ammo_template.id)
            } else {
                // Case 2: allowed item is kind of ammo magazine
                this.processSubSlots(slot_allowed_items, new_ammo_template)
            }                
        }
    }

    private processSubSlots(slot_allowed_items_ids: string[], new_ammo_template: LockpickAmmoTemplate) {
        const items = this.tables!.templates!.items!;

        for (const allowed_item_id of slot_allowed_items_ids) {            
            const allowed_item = items[allowed_item_id];
            this.processSingleItem(allowed_item, new_ammo_template)
        }
    }

    private processItemChambers(chambers: Slot[], new_ammo_template: LockpickAmmoTemplate) {
        for (const chamber of chambers) {
            const chamber_allowed_items = chamber._props.filters[0].Filter;
            if (chamber_allowed_items.includes(new_ammo_template.original_ammo_id)) {
                chamber_allowed_items.push(new_ammo_template.id);
            }
        }
    }

    private processItemCartridges(cartridges: Slot[], new_ammo_template: LockpickAmmoTemplate) {
        for (const cartridge of cartridges) {
            const cartridge_allowed_items = cartridge._props.filters[0].Filter;
            if (cartridge_allowed_items.includes(new_ammo_template.original_ammo_id)) {
                cartridge_allowed_items.push(new_ammo_template.id);
            }
        }
    }

    private addAmmoToAllMags(new_ammo_template: LockpickAmmoTemplate, ammo: string) {
        const tables = this.tables;
        const items = tables!.templates!.items!;

        const original_ammo_id = items[new_ammo_template.original_ammo_id];
        const original_caliber = original_ammo_id._props.ammoCaliber

        for (const item_id in items) {
            const item_template = items[item_id]!;
            if (item_template._props.Chambers === undefined) {
                continue;
            }
            if (item_template._props.ammoCaliber !== original_caliber) {
                continue;
            }

            const slotes = item_template._props.Slots!;
            for (const slot of slotes) {
                if (slot._name !== "mod_magazine") {
                    continue;
                }

                const mag_filters = slot._props.filters[0].Filter
                for (const mag_filter of mag_filters) {
                    if (!(mag_filter in items)) {
                        return;
                    }
            
                    const magazineID = items[mag_filter];
                    const cartridges = magazineID._props.Cartridges
                    const cartridge_props = cartridges?.[0]?._props
                    if (cartridge_props === undefined) {
                        return;
                    }
            
                    const cartridge_filter = cartridge_props.filters[0].Filter;
                    cartridge_filter.push(ammo);
                }
            }
        }
    }

    private addAmmoToAllChambers(new_ammo_template: LockpickAmmoTemplate, ammo: string) {
        const tables = this.tables;
        const items = tables!.templates!.items!;

        const base_item_caliber = items[new_ammo_template.original_ammo_id]._props.ammoCaliber

        for (const item_id in items) {
            const item_template = items[item_id];
            if (item_template._props.Chambers === undefined) {
                continue;
            }
            
            if (item_template._props.ammoCaliber !== base_item_caliber) {
                continue;
            }

            const chambers = item_template._props.Chambers;
            const chamber_props = chambers?.[0]?._props;
            if (chamber_props === undefined) {
                return;
            }

            for (const chamber of chambers!) {
                const z_Filter = chamber._props.filters[0].Filter;
                z_Filter.push(ammo);
            }
        }
    }


    private makeAmmoUsableWithRevolvingWeapons(itemId: string, ammoToAdd: string) {
        const tables = this.tables;
        const items = tables!.templates!.items!;

        const weaponID = items[itemId];
        for (const slot of weaponID._props.Slots!) {
            const z_Filter = slot._props.filters[0].Filter;
            z_Filter.push(ammoToAdd);
        }

        for (const cartridge of weaponID._props.Cartridges!) {
            const z_Filter = cartridge._props.filters[0].Filter;
            z_Filter.push(ammoToAdd);
        }
    }
}

module.exports = { mod: new LockpickAmmoMod() }