goal!("Clear Treacherous Tower", Goal::ClearTreacherousTower => {
                        normal: |p| (p.has_sword() || (p.swordless_mode() && p.can_attack())) && (p.has_bombs() || p.has_hammer() || p.has_tornado_rod()),
                        hard: |p| p.has_bombs() || p.has_hammer() || (p.has_tornado_rod() && p.can_attack()),
                    }),