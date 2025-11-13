#[derive (Clone)]
#[pyclass]
pub struct PyRandomizable {
    pub randomizable: Randomizable,
}

#[pyfunction]
pub fn new_item(item: Item) -> PyRandomizable {
    PyRandomizable { randomizable: Randomizable::Item(item) }
}

#[pyfunction]
pub fn new_goal(goal: Goal) -> PyRandomizable {
    PyRandomizable { randomizable: Randomizable::Goal(goal) }
}

#[pyfunction]
pub fn new_vane(vane: Vane) -> PyRandomizable {
    PyRandomizable { randomizable: Randomizable::Vane(vane) }
}

#[pyfunction]
pub fn new_crack(crack: Crack) -> PyRandomizable {
    PyRandomizable { randomizable: Randomizable::Crack(crack) }
}

impl From<PyRandomizable> for Randomizable {
    fn from(randomizable: PyRandomizable) -> Randomizable {
        randomizable.randomizable
    }
}

#[pymethods]
impl PyRandomizable {
    fn item_id(&self) -> Option<u16> {
        match self.randomizable {
            Randomizable::Item(item) => Some(item.to_game_item() as u16),
            _ => None,
        }
    }
}