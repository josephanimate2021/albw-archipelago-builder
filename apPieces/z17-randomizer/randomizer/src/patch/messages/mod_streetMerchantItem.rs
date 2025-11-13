    let item_left = seed_info.layout.get_unsafe("Street Merchant (Left)", regions::hyrule::kakariko::village::SUBREGION);
    let item_name_left = if let Some(info) = &seed_info.archipelago_info {
        match item_left {
            Randomizable::Item(LetterInABottle) => info.get_item_name("Street Merchant (Left)")?,
            _ => item_left.as_str().to_string(),
        }
    } else {
        item_left.as_str().to_string()
    };

    let item_right = seed_info.layout.get_unsafe("Street Merchant (Right)", regions::hyrule::kakariko::village::SUBREGION);
    let item_name_right = if let Some(info) = &seed_info.archipelago_info {
        match item_right {
            Randomizable::Item(LetterInABottle) => info.get_item_name("Street Merchant (Right)")?,
            _ => item_right.as_str().to_string(),
        }
    } else {
        item_right.as_str().to_string()
    };
