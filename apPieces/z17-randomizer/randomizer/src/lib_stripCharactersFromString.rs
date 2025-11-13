/// Strip all but certain characters from a string
fn sanitize(string: &str) -> String {
    let to_space = Regex::new(r"[_]").unwrap();
    let remove = Regex::new(r"[^A-Za-z0-9'\(\) ]").unwrap();
    remove.replace_all(&to_space.replace_all(string, " "), "").to_string()
}

#[derive(Serialize, Default, Debug, Clone)]
#[pyclass]
pub struct ArchipelagoInfo {
    #[pyo3(get, set)]
    pub name: String,

    #[pyo3(get, set)]
    pub item_names: DashMap<String, String>,
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
        self.item_names
            .get(location_name)
            .map(|s| sanitize(s))
            .ok_or(Error::internal(format!("Patch file does not contain an item for location {}", location_name)))
    }
}
