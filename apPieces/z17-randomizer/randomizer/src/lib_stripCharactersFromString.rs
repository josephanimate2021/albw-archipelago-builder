/// Strip all but certain characters from a string
fn sanitize(string: &str) -> String {
    let to_space = Regex::new(r"[_]").unwrap();
    let remove = Regex::new(r"[^A-Za-z0-9'\(\) ]").unwrap();
    remove.replace_all(&to_space.replace_all(string, " "), "").to_string()
}

#[derive(Serialize, Debug, Clone)]
#[pyclass]
pub struct ArchipelagoItem {
    pub name: String,
    pub classification: u8,
}

#[pymethods]
impl ArchipelagoItem {
    pub const CLASS_PROGRESSION: u8 = 1;
    pub const CLASS_USEFUL: u8 = 2;
    pub const CLASS_TRAP: u8 = 4;

    #[new]
    pub fn new(name: String, classification: u8) -> ArchipelagoItem {
        ArchipelagoItem {name, classification}
    }

    pub fn is_major(&self) -> bool {
        self.classification & Self::CLASS_PROGRESSION != 0
    }
}

#[derive(Serialize, Default, Debug, Clone)]
#[pyclass]
pub struct ArchipelagoInfo {
    #[pyo3(get, set)]
    pub name: String,

    #[pyo3(get, set)]
    pub items: DashMap<String, ArchipelagoItem>,
}

#[pymethods]
impl ArchipelagoInfo {
    #[new]
    pub fn new() -> ArchipelagoInfo {
        ArchipelagoInfo::default()
    }
}

impl ArchipelagoInfo {
    pub fn get_item_name(&self, location_name: &str) -> Result<String> {
        self.items
            .get(location_name)
            .map(|item| sanitize(&item.name))
            .ok_or(Error::internal(format!("Patch file does not contain an item for location {}", location_name)))
    }
}
