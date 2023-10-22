import { DependencyContainer } from "tsyringe";
// SPT types
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { IDatabaseTables } from "@spt-aki/models/spt/server/IDatabaseTables";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import { SecuredContainers } from "@spt-aki/models/enums/ContainerTypes"
import { LOCKPICK_AMMO_TAG, LockpickAmmoTemplate } from "./zod_types";
import { Ammo12Gauge } from "@spt-aki/models/enums/AmmoTypes";


class LockpickAmmoMod implements IPostDBLoadMod {
    private mod: string
    private logger: null | ILogger = null
    private container: null | DependencyContainer = null
    private jsonUtil: null | JsonUtil = null
    private tables: null | IDatabaseTables = null

    constructor() {
        this.mod = "LockpickAmmo"; // Set name of mod so we can log it to console later
    }

    /**
     * Majority of trader-related work occurs after the aki database has been loaded but prior to SPT code being run
     * @param container Dependency container
     */
    public postDBLoad(container: DependencyContainer): void {
        this.container = container;
        this.jsonUtil = container.resolve<JsonUtil>("JsonUtil");
        const databaseServer = this.container.resolve<DatabaseServer>("DatabaseServer");
        this.tables = databaseServer.getTables();
        this.logger = container.resolve<ILogger>("WinstonLogger");

        this.setupLockpickAmmo()
        this.logger.debug(`[${this.mod}] postDb Loaded`);
    }

    private setupLockpickAmmo(): void {
        const defaultTemplate = LockpickAmmoTemplate.parse({});
        const anotherTemplate = LockpickAmmoTemplate.parse({});
        anotherTemplate.id = LOCKPICK_AMMO_TAG + " Another template id"
        anotherTemplate.name = "Another template"
        anotherTemplate.short_name = "Another template"
        anotherTemplate.original_ammo_id = Ammo12Gauge.AP20_ARMOR_PIERCING_SLUG

        const templates = [defaultTemplate, anotherTemplate]
        for (const ammo_template of templates) {
            
            this.logger!.info(`[${this.mod}] id: ${ammo_template.id}`);
            this.createNewAmmo(ammo_template);
        }
    }

    private createNewAmmo(new_ammo_template: LockpickAmmoTemplate): void {
        if (this.isIdAlreadyExists(new_ammo_template.id)) {
            this.logger!.warning(`[${this.mod}] id ${new_ammo_template.id} already exists`);
        }

        this.deleteItem(new_ammo_template.id)
        this.createItem(new_ammo_template)

        this.deleteItemLocale(new_ammo_template)
        this.createItemLocale(new_ammo_template)

        this.removeItemFromHandbook(new_ammo_template.id)
        this.addItemToHandbook(new_ammo_template)

        this.removeItemFromTraders(new_ammo_template)
        this.addItemToTraders(new_ammo_template)

        this.deleteFromSecureContainers(new_ammo_template.id)
        this.allowIntoSecureContainers(new_ammo_template.id)
    }

    private isIdAlreadyExists(id: string): boolean {
        const items = this.tables?.templates?.items[id]
        return items !== undefined && id in items;
    }

    private deleteItem(id: string) {
        delete this.tables!.templates!.items[id];
    }

    private createItem(new_ammo_template: LockpickAmmoTemplate) {
        const item = this.jsonUtil!.clone(this.tables!.templates!.items[new_ammo_template.original_ammo_id]);
        item._id = new_ammo_template.id;

        const ammo_options = new_ammo_template.ammo_options;
        const props = item._props;

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

        item._props = props;
        this.tables!.templates!.items[new_ammo_template.id] = item;
    }

    private deleteItemLocale(new_ammo_template: LockpickAmmoTemplate) {
        const locales = Object.values(this.tables!.locales!.global) as Record<string, string>[];
        for (const locale of locales) {
            delete locale[`${new_ammo_template.id} Name`]
            delete locale[`${new_ammo_template.id} ShortName`]
            delete locale[`${new_ammo_template.id} Description`]
        }
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
        this.logger!.info(`[${this.mod}] hb id: ${new_ammo_template.id}`);

        const handbook = this.tables!.templates!.handbook;

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require("fs")
        let data = ""
        for (const item of handbook.Items) {
            data += item.Id + "\n"
        }
        fs.writeFileSync(String.raw`C:\Games\SPT_3_7_1\user\mods\nektonick-lockpick_ammo-1.0.0\output.txt`, data);

        const base_handbook_item = handbook.Items.find((item) => item.Id == new_ammo_template.original_ammo_id)
        if (base_handbook_item === undefined) {
            return;
        }
        handbook.Items.push({
            Id: new_ammo_template.id,
            ParentId: base_handbook_item.ParentId,
            Price: new_ammo_template.price_in_handbook
        });
        
        data = ""
        for (const item of handbook.Items) {
            data += item.Id + "\n"
        }
        fs.writeFileSync(String.raw`C:\Games\SPT_3_7_1\user\mods\nektonick-lockpick_ammo-1.0.0\output.txt`, data);
    }

    private removeItemFromHandbook(id: string) {
        const handbook = this.tables!.templates!.handbook;
        const item = handbook.Items.find((item) => item.Id === id)
        if (item === undefined) {
            return;
        }
        this.logger!.warning(`[${this.mod}] id ${id} already exists in handbook`);

        handbook.Items = handbook.Items.filter((item) => item.Id !== id)
    }

    private removeItemFromTraders(new_ammo_template: LockpickAmmoTemplate) {
        for (const trader_options of new_ammo_template.traders_options) {
            const trader = this.tables!.traders![trader_options.trader];
            const trader_assort = trader.assort;
            trader_assort.items = trader_assort.items.filter(item => item._id !== new_ammo_template.id)
            delete trader_assort.barter_scheme[new_ammo_template.id]
            delete trader_assort.loyal_level_items[new_ammo_template.id]
        }
    }

    private addItemToTraders(new_ammo_template: LockpickAmmoTemplate) {
        for (const trader_options of new_ammo_template.traders_options) {
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

    private deleteFromSecureContainers(item_id: string) {
        const items = this.tables?.templates?.items;
        for (const secure_container of [SecuredContainers.ALPHA, SecuredContainers.BETA, SecuredContainers.EPSILON, SecuredContainers.GAMMA, SecuredContainers.KAPPA]) {
            const container_props = items![secure_container]._props;
            const grid_filter = container_props.Grids![0]._props.filters[0];
            grid_filter.Filter = grid_filter.Filter.filter(item => item !== item_id)
        }
    }

    private allowIntoSecureContainers(item_id: string): void {
        const items = this.tables?.templates?.items;
        for (const secure_container of [SecuredContainers.ALPHA, SecuredContainers.BETA, SecuredContainers.EPSILON, SecuredContainers.GAMMA, SecuredContainers.KAPPA]) {
            const container_props = items![secure_container]._props;
            container_props.Grids![0]._props.filters[0].Filter.push(item_id)
        }
    }
}

module.exports = { mod: new LockpickAmmoMod() }