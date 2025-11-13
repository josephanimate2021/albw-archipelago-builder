if let Some(info) = &seed_info.archipelago_info {
        // Repurpose Letter in a Bottle as Archipelago Item
        item_name.set("item_name_messagebottle", "Archipelago Item");

        // Ravio items
        item_name.set("item_name_icerod_LV2", &info.get_item_name("Ravio's Shop (1)")?);
        item_name.set("item_name_hookshot_LV2", &info.get_item_name("Ravio's Shop (2)")?);
        item_name.set("item_name_tornaderod_LV2", &info.get_item_name("Ravio's Shop (3)")?);
        item_name.set("item_name_bomb_LV2", &info.get_item_name("Ravio's Shop (4)")?);
        item_name.set("item_name_bow_LV2", &info.get_item_name("Ravio's Shop (5)")?);
        item_name.set("item_name_sandrod_LV2", &info.get_item_name("Ravio's Shop (6)")?);
        item_name.set("item_name_hammer_LV2", &info.get_item_name("Ravio's Shop (7)")?);
        item_name.set("item_name_boomerang_LV2", &info.get_item_name("Ravio's Shop (8)")?);
        item_name.set("item_name_firerod_LV2", &info.get_item_name("Ravio's Shop (9)")?);
    }