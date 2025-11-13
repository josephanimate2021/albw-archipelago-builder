fn patch_archipelago(code: &mut Code, seed: u32, name: &str) {
    let archipelago_header = code.rodata().declare([0x41, 0x52, 0x43, 0x48]); // magic number
    code.rodata().declare([1, 0, 0, 0]); // data version
    code.rodata().declare(seed.to_le_bytes()); // seed
    code.rodata().declare([0xff, 0xff, 0xff, 0xff]); // placeholder for received item
    let mut name_bytes = name.as_bytes().to_vec();
    name_bytes.resize(0x40, 0);
    code.rodata().declare(name_bytes); // username padded to 0x40 bytes
    let received_items_counter = code.rodata().declare([0xff, 0xff, 0xff, 0xff]);

    // Save Archipelago information
    let patch_create_save = code.text().define([
        ldr(R0, archipelago_header),
        ldr(R0, (R0, 0x0)),
        str_(R0, (R5, 0xde0)), // magic number
        ldr(R0, archipelago_header),
        ldr(R0, (R0, 0x4)),
        str_(R0, (R5, 0xde4)), // data version
        ldr(R0, archipelago_header),
        ldr(R0, (R0, 0x8)),
        str_(R0, (R5, 0xde8)), // seed
        mov(R0, 0x0),
        str_(R0, (R5, 0xdec)), // received items count
        mov(R0, R5),
        b(0x1df5b0),
    ]);
    code.patch(0x1df5ac, [b(patch_create_save)]);

    // Receive items from the server
    let receive_items_timer = code.rodata().declare([0, 0, 0, 0]);
    let receive_items_skip = code.text().define([
        pop(&[R0, R1, R4, R5, R6, LR]),
        b(0x349214),
    ]);
    let receive_items = code.text().define([
        // Return to normal function if player state is not 0 (standing) or 1 (walking)
        push(&[R0, R1, R4, R5, R6, LR]),
        cmp(R1, 0x0),
        cmp(R1, 0x1).ne(),
        b(receive_items_skip).ne(),
        // Return to normal function if received item is -1
        ldr(R4, archipelago_header),
        ldr(R4, (R4, 0xc)),
        add(R5, R4, 0x1),
        cmp(R5, 0x0),
        b(receive_items_skip).eq(),
        // Return to normal function if timer is still going
        ldr(R6, receive_items_timer),
        ldr(R5, (R6, 0x0)),
        cmp(R5, 0x0),
        sub(R5, R5, 0x1).ne(),
        str_(R5, (R6, 0x0)),
        b(receive_items_skip).ne(),
        // Call get item routine
        ldr(R0, PLAYER_OBJECT_SINGLETON),
        ldr(R0, (R0, 0x0)),
        mov(R1, R4),
        mov(R2, 0x0),
        bl(0x36174c),
        // Return to normal function if item get failed
        cmp(R0, 0x0),
        b(receive_items_skip).eq(),
        // Increment received items counter
        ldr(R4, received_items_counter),
        ldr(R5, (R4, 0)),
        add(R5, R5, 1),
        str_(R5, (R4, 0)),
        // Set received item to -1
        ldr(R4, archipelago_header),
        ldr(R5, -0x1),
        str_(R5, (R4, 0xc)),
        pop(&[R0, R1, R4, R5, R6, LR]),
        bx(LR),
    ]);
    code.addr(0x6e30ac, receive_items);

    // Save the received items counter when saving the game
    let save_received_items_counter = code.text().define([
        ldr(R1, received_items_counter),
        ldr(R1, (R1, 0)),
        str_(R1, (R0, 0xdec)),
        b(0x320b74),
    ]);
    code.patch(0x4c3d60, [bl(save_received_items_counter)]);

    // Load the received items counter when loading the game
    let load_received_items_counter = code.text().define([
        ldr(R1, received_items_counter),
        ldr(R0, (R4, 0x14)),
        ldr(R0, (R0, 0xdec)),
        str_(R0, (R1, 0)),
        ldr(R1, archipelago_header),
        ldr(R0, -1),
        str_(R0, (R1, 0xc)),
        b(0x4ad758),
    ]);
    code.patch(0x4c3b68, [bl(load_received_items_counter)]);

    // Allow getting items outside of an event
    let get_item_patch = code.text().define([
        push(&[R4, R5, R6]),
        ldr(R4, EVENT_FLAG_PTR),
        ldr(R4, (R4, 0)),
        ldr(R5, (R4, 0x10)),
        mov(R6, 0x1),
        str_(R6, (R4, 0x10)),
        blx(R2),
        str_(R5, (R4, 0x10)),
        pop(&[R4, R5, R6]),
        b(0x2922fc),
    ]);
    code.patch(0x2922f8, [b(get_item_patch)]);

    // Prevent getting item during stamina scroll animation
    let fix_get_stamina_scroll = code.text().define([
        cmp(R0, 0x45),
        b(0x344834).ne(),
        mov(R0, 0xf0),
        ldr(R1, receive_items_timer),
        str_(R0, (R1, 0x0)),
        mov(R0, 0x1),
        bx(LR),
    ]);
    code.patch(0x028edf0, [bl(fix_get_stamina_scroll)]);

    // Repurpose Letter in a Bottle as Archipelago Item
    code.patch(0x345578, [b(0x344f00)]);
    code.addr(0x3447c4, 0x34482c);

    // Allow Ravio items to have arbitrary names
    let change_ravio_text = code.text().define([
        ldr(R1, 0x714694),
        ldr(R0, (R1, R0, 2)),
        bx(LR),
    ]);
    code.patch(0x55af28, [b(change_ravio_text)]);
}