const serviceSelect = document.getElementById('service-select');
const dateSection = document.getElementById('date-section');
const dateInput = document.getElementById('date-input');
const availabilitySection = document.getElementById('availability-section');
const timeSlotsDiv = document.getElementById('time-slots');
const bookingFormSection = document.getElementById('booking-form-section');
const bookingForm = document.getElementById('booking-form');
const appointmentsList = document.getElementById('appointments-list');

// Load services
fetch('/services')
  .then(response => response.json())
  .then(services => {
    services.forEach(service => {
      const option = document.createElement('option');
      option.value = service.id;
      option.text = `${service.name} ($${service.price}, ${service.duration} min)`;
      serviceSelect.appendChild(option);
    });
  });

// Load appointments
function loadAppointments() {
    fetch('/appointments')
      .then(response => response.json())
      .then(appointments => {
        appointmentsList.innerHTML = '';
        appointments.forEach(appt => {
          const li = document.createElement('li');
          li.textContent = `${appt.customer_name} - ${appt.service_name} with ${appt.technician_name} on ${appt.date} at ${appt.time_slot}`;
          const cancelButton = document.createElement('button');
          cancelButton.textContent = 'Cancel';
          cancelButton.style.marginLeft = '10px';
          cancelButton.style.backgroundColor = '#ff4444';
          cancelButton.style.color = 'white';
          cancelButton.style.border = 'none';
          cancelButton.style.padding = '5px 10px';
          cancelButton.style.cursor = 'pointer';
          cancelButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel this appointment?')) {
              fetch(`/appointments/${appt.id}`, {
                method: 'DELETE',
              })
                .then(response => response.json())
                .then(data => {
                  alert(data.message);
                  loadAppointments(); // Refresh the list
                })
                .catch(error => {
                  console.error('Error cancelling appointment:', error);
                  alert('Failed to cancel appointment');
                });
            }
          });
          li.appendChild(cancelButton);
          appointmentsList.appendChild(li);
        });
      })
      .catch(error => {
        console.error('Error loading appointments:', error);
      });
  }

serviceSelect.addEventListener('change', () => {
  dateSection.style.display = serviceSelect.value ? 'block' : 'none';
  availabilitySection.style.display = 'none';
  bookingFormSection.style.display = 'none';
});

dateInput.addEventListener('change', () => {
  const serviceId = serviceSelect.value;
  const date = dateInput.value;
  if (serviceId && date) fetchAvailability(serviceId, date);
});

function fetchAvailability(serviceId, date) {
  fetch(`/availability?service_id=${serviceId}&date=${date}`)
    .then(response => response.json())
    .then(availability => {
      timeSlotsDiv.innerHTML = '';
      for (const [slot, technicians] of Object.entries(availability)) {
        if (technicians.length > 0) {
          const slotDiv = document.createElement('div');
          slotDiv.innerHTML = `<strong>${slot}</strong>`;
          const techList = document.createElement('ul');
          technicians.forEach(tech => {
            const li = document.createElement('li');
            li.innerHTML = `${tech.name} <button data-time-slot="${slot}" data-technician-id="${tech.id}">Select</button>`;
            techList.appendChild(li);
          });
          slotDiv.appendChild(techList);
          timeSlotsDiv.appendChild(slotDiv);
        }
      }
      availabilitySection.style.display = 'block';
    });
}

timeSlotsDiv.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      const timeSlot = e.target.dataset.timeSlot;
      const technicianId = e.target.dataset.technicianId;
      document.getElementById('selected-time-slot').value = timeSlot;
      document.getElementById('selected-technician-id').value = technicianId;
      // Add this: Display the selection
      const technicianName = e.target.parentElement.textContent.split(' ')[0]; // Get technician name
      document.getElementById('selection-info').textContent = `Booking for ${technicianName} at ${timeSlot}`;
      bookingFormSection.style.display = 'block';
    }
  });

bookingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const customerName = document.getElementById('customer-name').value;
  const phone = document.getElementById('phone').value;
  const email = document.getElementById('email').value;
  const serviceId = serviceSelect.value;
  const technicianId = document.getElementById('selected-technician-id').value;
  const date = dateInput.value;
  const timeSlot = document.getElementById('selected-time-slot').value;

  fetch('/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_name: customerName, phone, email, service_id: serviceId, technician_id: technicianId, date, time_slot: timeSlot }),
  })
    .then(response => response.json())
    .then(data => {
      alert(data.message);
      bookingForm.reset();
      bookingFormSection.style.display = 'none';
      loadAppointments();
    });
});