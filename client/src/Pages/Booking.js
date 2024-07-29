import React, { useState, useEffect, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import * as Yup from 'yup';
import Navbar from "../Components/Navbar";
import '../Styles/bookingform.css';
// Imports for Stripe
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
const stripePromise = loadStripe("pk_test_51PVRhkBQYdvRSbbUXQbqZZEgSjlMuM8FukpdV9gtGgYfa0JnICzsxzDtP484SVHZ81fLrPyCt7qEOcagnpfRFP8M009ejwRR6i");


// Payment Button Component included by form component that will call handlebuttonclick function
//that will pay AND THEN when payment successful submit the form
function Button({ isProcessingStripe,submitPayment }) {
    //create stripe and elements instance
    const stripe = useStripe();
    const elements = useElements();
    //styling and rendering of button, all functions defined in main/EachHotel()
    const buttonStyle = {
        backgroundColor: '#28a745', // Green color
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        padding: '12px 24px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'background-color 0.3s ease',
        width: '100%',
        textAlign: 'center'
    };

    const buttonDisabledStyle = {
        ...buttonStyle,
        backgroundColor: '#6c757d', // Grey color for disabled state
        cursor: 'not-allowed'
    };

    //render button
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '15vh' }}>
            <button
                style={isProcessingStripe ? buttonDisabledStyle : buttonStyle}
                onClick={() => submitPayment(stripe, elements)}
                disabled={isProcessingStripe}
            >
                <span>
                    {isProcessingStripe ? "Processing... " : "Pay & Submit"}
                </span>
            </button>
        </div>
    );
}
//added button component ends here


//form component
function EachHotel() {
    let { hid } = useParams();
    let location = useLocation();
    let navigate = useNavigate();

    const { startDate, endDate, guests, destinationId, hotelName } = location.state || {};
    const [loading, setLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState("");
    const effectRan = useRef(false); // Track if the effect has run
    const [isProcessingStripe, setIsProcessingStripe] = useState(false);//states for Stripe
    const[paymentIntentStatus,setPaymentIntentStatus]=useState("");//state for payment successful or not
    const formikRef = useRef(null);//form instance

    const personalDetails = {
        firstName: "",
        lastName: "",
        phoneNo: "",
        email: "",
        special_req: "",
        hotelID: hid,
        destID: destinationId
    };

    const validationSchema = Yup.object({
        firstName: Yup.string().required('Required'),
        lastName: Yup.string().required('Required'),
        phoneNo: Yup.string().matches(/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s/0-9]*$/, 'Invalid Phone Number').required('Required'),
        email: Yup.string().email('Invalid email format').required('Required'),
        special_req: Yup.string(),
        hotelID: Yup.string().required('Required'),
        destID: Yup.string().required('Required')
    });

    const updateDB = async (data) => {
        setLoading(true);
        try {
            await axios.post("http://localhost:3004/booking", data);
            console.log(`Data added!`);
            navigate("/confirmation");
        } catch (error) {
            console.error('Error booking the hotel!', error);
        } finally {
            setLoading(false);
        }
    };

    //function called when payment button clicked, handle payment AND form submission
    //to make the UI nicer and have only one button while ensuring payment is check first before 
    //form is submitted
    async function handleSubmitClick(stripe, elements) {
        console.log("handleSubmitClick")
        if (!stripe || !elements) return;
        setIsProcessingStripe(true);
        if (paymentIntentStatus!=='succeeded'){
            try {
                // Confirm the payment with Stripe
                await stripe.confirmPayment({
                    elements,
                    redirect: 'if_required'
                });

                const paymentIntentStatus = await stripe.retrievePaymentIntent(clientSecret);
                setPaymentIntentStatus(paymentIntentStatus.paymentIntent.status )

                } catch (err) {
                    console.error('Error during payment:', err);
                } finally {
                    setIsProcessingStripe(false);
                }
            }else{
                setIsProcessingStripe(false);
                formikRef.current.submitForm();
            }
    }


    //useEffect will be called ONLY first time screen renders to ensure that only one payment transaction
    //determined by the clientSecret is called
    //so that when form fails to submit after payment goes through, resubmitting teh form will not craete a second payment session

    useEffect(() => {
        if (effectRan.current) return;
        effectRan.current = true;

        console.log("useEffect called");
        fetch("http://localhost:3004/booking/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        })
        .then(async (r) => {
            const { clientSecret } = await r.json();
            setClientSecret(clientSecret);
        })
        .catch(error => console.error('Error fetching client secret:', error));
    }, []);

    return (
        <>
            <Navbar />
            <div className="hotel-header">
                <h1>Hotel Booking</h1>
                <p>Hotel Name: {hotelName}</p>
                <p>Start Date: {startDate}</p>
                <p>End Date: {endDate}</p>
                <p>Guests: {guests ? `Adults: ${guests.adults}, Children: ${guests.children}, Rooms: ${guests.rooms}` : 'N/A'}</p>
            </div>

            <div className="booking-form">
                <Formik
                    initialValues={personalDetails}
                    validationSchema={validationSchema}
                    onSubmit={updateDB} // Formik's onSubmit is not used directly
                    innerRef={formikRef} //get a ref to this form instance so that handleSubmitClick triggered by payment button can trigger submit form
                >
                        <Form>
                            <div className="form-group">
                                <label htmlFor="infirstName">First Name</label>
                                <Field id="infirstName" name="firstName" placeholder="John" className="form-field" />
                                <ErrorMessage name="firstName" component="div" className="error-message" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="inlastName">Last Name</label>
                                <Field id="inlastName" name="lastName" placeholder="Doe" className="form-field" />
                                <ErrorMessage name="lastName" component="div" className="error-message" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="inphoneNo">Phone Number</label>
                                <Field id="inphoneNo" name="phoneNo" placeholder="+65 85848392" className="form-field" />
                                <ErrorMessage name="phoneNo" component="div" className="error-message" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="inemail">Email</label>
                                <Field id="inemail" name="email" placeholder="abc@mail.com" className="form-field" />
                                <ErrorMessage name="email" component="div" className="error-message" />
                            </div>

                            <div className="form-group">
                                <label htmlFor="inspecial_req">Special Requests</label>
                                <Field id="inspecial_req" name="special_req" placeholder="Green Bed sheets" className="form-field" />
                                <ErrorMessage name="special_req" component="div" className="error-message" />
                            </div>

                            <div>
                                {clientSecret && (
                                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                                        <PaymentElement />
                                        <Button isProcessingStripe={isProcessingStripe} submitPayment={handleSubmitClick} />
                                    </Elements>
                                )}
                            </div>
                    
                        </Form>
                </Formik>
            </div>

            {loading && (
                <div className="loading-screen">
                    <div className="loading-spinner"></div>
                    <p>Confirming your reservation...</p>
                </div>
            )}
        </>
    );
}

export default EachHotel;