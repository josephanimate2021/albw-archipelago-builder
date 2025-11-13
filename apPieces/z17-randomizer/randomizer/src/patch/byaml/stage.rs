fn patch_npc_hinox(patcher: &mut Patcher) {
    // Change Hinox flag to an event flag
    patcher.modify_objs(
        CaveDark,
        6,
        [
            set_46_args(8, Flag::NPC_HINOX),
            set_enable_flag(8, Flag::NPC_HINOX),
        ]
    );
}
