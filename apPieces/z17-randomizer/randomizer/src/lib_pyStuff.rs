#[pyfunction]
pub fn randomize_pre_fill(seed: u32, settings: Settings, archipelago_info: Option<ArchipelagoInfo>) -> SeedInfo {
    let rng = &mut StdRng::seed_from_u64(seed.clone() as u64);
    let hash = SeedHash::new(seed.clone(), &settings);
    VARS_BUILD
    SeedInfo {
        seed,
        version: VERSION.to_owned(),
        hash,
        archipelago_info,
        settings,
        full_exclusions: Default::default(),
        removed_from_play: Default::default(),
        MAPS
        layout: Default::default(),
        metrics: Default::default(),
        hints: Default::default(),
    }
}

#[pymethods]
impl SeedInfo {
    pub fn get_region_graph(&self) -> DashMap<String, (Vec<String>, Vec<String>)> {
        self.world_graph.iter().map(|(location, location_node)|
            (location.to_string(), (
                match location_node.get_checks() {
                    None => Vec::new(),
                    Some(checks) => checks.iter().map(|check| check.get_name().to_string()).collect(),
                },
                match location_node.get_paths() {
                    None => Vec::new(),
                    Some(paths) => paths.iter().map(|path| path.get_destination().to_string()).collect(),
                }
            ))
        ).collect()
    }

    pub fn can_reach(&self, check_name: &str, items: Vec<PyRandomizable>) -> bool {
        let mut progress = Progress::new(&self);
        for item in items {
            progress.add_item(item);
        }

        if let Some(check) = self.world_graph.get_check(check_name) {
            return check.can_access(&progress);
        }

        panic!("{} is not the name of a check", check_name);
    }

    pub fn can_traverse(&self, source_name: &str, target_name: &str, items: Vec<PyRandomizable>) -> bool {
        let mut progress = Progress::new(&self);
        for item in items {
            progress.add_item(item);
        }

        let source_region = Location::from_str(source_name)
            .expect(&format!("No region {} found", source_name));
        if let Some(paths) = self.world_graph[&source_region].get_paths() {
            for path in paths {
                if path.get_destination().to_string() == target_name {
                    return path.can_access(&progress);
                }
            }
        }

        panic!("No path from {} to {}", source_name, target_name);
    }

    pub fn access_check(&self) -> bool {
        let mut rng = StdRng::seed_from_u64(self.seed.clone() as u64);
        let mut check_map = filler::prefill_check_map(&self.world_graph);
        access_check(&mut rng, &self, &mut check_map)
    }
    
    pub fn build_layout(&mut self, new_check_map: DashMap<String, PyRandomizable>) {
        let mut check_map = filler::prefill_check_map(&mut self.world_graph);
        for (name, item) in new_check_map {
            check_map.insert(name, Some(item.into()));
        }
        filler::build_layout(self, &mut check_map).unwrap();
    }

    pub fn patch(&self, rom_path: &str, out_path: &str) {
        let user_config = UserConfig::new(rom_path.into(), out_path.into());
        patch_seed(self, &user_config, false, true).unwrap();
    }
}
