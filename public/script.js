document.addEventListener('DOMContentLoaded', () => {
  const serviceSelect = document.getElementById('service-select');
  const dateSection = document.getElementById('date-section');
  const dateInput = document.getElementById('date-input');
  const availabilitySection = document.getElementById('availability-section');
  const timeSlotsDiv = document.getElementById('time-slots');
  const bookingFormSection = document.getElementById('booking-form-section');
  const bookingForm = document.getElementById('booking-form');
  const appointmentsList = document.getElementById('appointments-list');

  // Initialize Flatpickr
  flatpickr(dateInput, {
    dateFormat: "Y-m-d",
    minDate: "today",
    disable: [
      function(date) {
        // Disable weekends (Saturday and Sunday)
        return (date.getDay() === 0 || date.getDay() === 6);
      }
    ],
    onChange: function(selectedDates, dateStr) {
      const serviceId = serviceSelect.value;
      if (serviceId && dateStr) fetchAvailability(serviceId, dateStr);
    }
  });

  // Load services
  fetch('/services')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(services => {
      console.log('Services fetched:', services);
      services.forEach(service => {
        const option = document.createElement('option');
        option.value = service.id;
        option.text = `${service.name} ($${service.price}, ${service.duration} min)`;
        serviceSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error fetching services:', error);
    });

  // Load appointments for the current customer
  function loadAppointments() {
    const customerId = localStorage.getItem('customer_id');
    if (!customerId) {
      appointmentsList.innerHTML = '<li>Please book an appointment to see your bookings.</li>';
      return;
    }
    fetch(`/appointments?customer_id=${encodeURIComponent(customerId)}`)
      .then(response => response.json())
      .then(appointments => {
        appointmentsList.innerHTML = '';
        if (appointments.length === 0) {
          appointmentsList.innerHTML = '<li>No appointments found.</li>';
          return;
        }
        appointments.forEach(appt => {
          const li = document.createElement('li');
          li.textContent = `${appt.customer_name} - ${appt.service_name} with ${appt.technician_name} on ${appt.date} at ${appt.time_slot}`;
          const cancelButton = document.createElement('button');
          cancelButton.textContent = 'Cancel';
          cancelButton.classList.add('cancel-button');
          cancelButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel this appointment?')) {
              fetch(`/appointments/${appt.id}`, {
                method: 'DELETE',
              })
                .then(response => response.json())
                .then(data => {
                  alert(data.message);
                  loadAppointments();
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
  loadAppointments();

  serviceSelect.addEventListener('change', () => {
    dateSection.style.display = serviceSelect.value ? 'block' : 'none';
    availabilitySection.style.display = 'none';
    bookingFormSection.style.display = 'none';
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
      const technicianName = e.target.parentElement.textContent.split(' ')[0];
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

    localStorage.setItem('customer_id', customerName);

    console.log('Submitting booking:', { customer_id: customerName, customer_name: customerName, phone, email, service_id: serviceId, technician_id: technicianId, date, time_slot: timeSlot });

    fetch('/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerName, customer_name: customerName, phone, email, service_id: serviceId, technician_id: technicianId, date, time_slot: timeSlot }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Booking response:', data);
        alert(data.message);
        bookingForm.reset();
        bookingFormSection.style.display = 'none';
        loadAppointments();
      })
      .catch(error => {
        console.error('Error submitting booking:', error);
      });
  });
});