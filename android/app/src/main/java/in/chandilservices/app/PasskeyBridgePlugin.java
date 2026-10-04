package in.chandilservices.app;

import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreatePublicKeyCredentialRequest;
import androidx.credentials.CreatePublicKeyCredentialResponse;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.GetPublicKeyCredentialOption;
import androidx.credentials.PublicKeyCredential;
import androidx.credentials.exceptions.CreateCredentialCancellationException;
import androidx.credentials.exceptions.CreateCredentialCustomException;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.CreateCredentialInterruptedException;
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException;
import androidx.credentials.exceptions.CreateCredentialUnknownException;
import androidx.credentials.exceptions.CreateCredentialUnsupportedException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialCustomException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialInterruptedException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;
import androidx.credentials.exceptions.GetCredentialUnknownException;
import androidx.credentials.exceptions.GetCredentialUnsupportedException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native Android Credential Manager bridge for WebAuthn / Passkeys.
 * Implements createCredential and getCredential using standard Android Jetpack CredentialManager APIs.
 * Preserves backend WebAuthn challenge generation, assertion/attestation verification, and RBAC.
 * Never handles, generates, or exposes biometric data or private keys.
 */
@CapacitorPlugin(name = "PasskeyBridge")
public class PasskeyBridgePlugin extends Plugin {

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        // Android Credential Manager supports Passkeys on Android 9 (API 28) and above via Google Play Services,
        // and natively on Android 14 (API 34) and above.
        boolean supported = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P;
        ret.put("isSupported", supported);
        call.resolve(ret);
    }

    @PluginMethod
    public void createCredential(PluginCall call) {
        String requestJson = call.getString("requestJson");
        if (requestJson == null || requestJson.trim().isEmpty()) {
            call.reject("VALIDATION_ERROR", "requestJson is required for createCredential.");
            return;
        }

        if (requestJson.length() > 65536) {
            call.reject("VALIDATION_ERROR", "requestJson payload exceeds maximum allowed size (64 KB).");
            return;
        }

        if (getActivity() == null) {
            call.reject("INTERNAL_ERROR", "Host activity is unavailable.");
            return;
        }

        try {
            CredentialManager credentialManager = CredentialManager.create(getContext());
            CreatePublicKeyCredentialRequest request = new CreatePublicKeyCredentialRequest(requestJson);
            CancellationSignal cancellationSignal = new CancellationSignal();

            credentialManager.createCredentialAsync(
                getActivity(),
                request,
                cancellationSignal,
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                    @Override
                    public void onResult(@NonNull CreateCredentialResponse result) {
                        if (result instanceof CreatePublicKeyCredentialResponse) {
                            CreatePublicKeyCredentialResponse pkc = (CreatePublicKeyCredentialResponse) result;
                            String registrationJson = pkc.getRegistrationResponseJson();
                            JSObject ret = new JSObject();
                            ret.put("responseJson", registrationJson);
                            call.resolve(ret);
                        } else {
                            call.reject("UNEXPECTED_RESPONSE", "Received unexpected credential creation response type.");
                        }
                    }

                    @Override
                    public void onError(@NonNull CreateCredentialException e) {
                        if (e instanceof CreateCredentialCancellationException) {
                            call.reject("CANCELLATION", e.getMessage(), e);
                        } else if (e instanceof CreateCredentialUnsupportedException) {
                            call.reject("UNSUPPORTED", e.getMessage(), e);
                        } else if (e instanceof CreateCredentialProviderConfigurationException) {
                            call.reject("PROVIDER_ERROR", e.getMessage(), e);
                        } else if (e instanceof CreateCredentialCustomException) {
                            call.reject("SECURITY_ERROR", e.getMessage(), e);
                        } else if (e instanceof CreateCredentialInterruptedException) {
                            call.reject("INTERRUPTED", e.getMessage(), e);
                        } else if (e instanceof CreateCredentialUnknownException) {
                            call.reject("UNKNOWN_ERROR", e.getMessage(), e);
                        } else {
                            call.reject("FAILED", e.getMessage(), e);
                        }
                    }
                }
            );
        } catch (Exception ex) {
            call.reject("EXCEPTION", ex.getMessage(), ex);
        }
    }

    @PluginMethod
    public void getCredential(PluginCall call) {
        String requestJson = call.getString("requestJson");
        if (requestJson == null || requestJson.trim().isEmpty()) {
            call.reject("VALIDATION_ERROR", "requestJson is required for getCredential.");
            return;
        }

        if (requestJson.length() > 65536) {
            call.reject("VALIDATION_ERROR", "requestJson payload exceeds maximum allowed size (64 KB).");
            return;
        }

        if (getActivity() == null) {
            call.reject("INTERNAL_ERROR", "Host activity is unavailable.");
            return;
        }

        try {
            CredentialManager credentialManager = CredentialManager.create(getContext());
            GetPublicKeyCredentialOption option = new GetPublicKeyCredentialOption(requestJson);
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build();
            CancellationSignal cancellationSignal = new CancellationSignal();

            credentialManager.getCredentialAsync(
                getActivity(),
                request,
                cancellationSignal,
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse result) {
                        Credential credential = result.getCredential();
                        if (credential instanceof PublicKeyCredential) {
                            PublicKeyCredential pkc = (PublicKeyCredential) credential;
                            String authJson = pkc.getAuthenticationResponseJson();
                            JSObject ret = new JSObject();
                            ret.put("responseJson", authJson);
                            call.resolve(ret);
                        } else {
                            call.reject("UNEXPECTED_RESPONSE", "Received unexpected credential type.");
                        }
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {
                            call.reject("CANCELLATION", e.getMessage(), e);
                        } else if (e instanceof NoCredentialException) {
                            call.reject("NO_CREDENTIAL", e.getMessage(), e);
                        } else if (e instanceof GetCredentialUnsupportedException) {
                            call.reject("UNSUPPORTED", e.getMessage(), e);
                        } else if (e instanceof GetCredentialProviderConfigurationException) {
                            call.reject("PROVIDER_ERROR", e.getMessage(), e);
                        } else if (e instanceof GetCredentialCustomException) {
                            call.reject("SECURITY_ERROR", e.getMessage(), e);
                        } else if (e instanceof GetCredentialInterruptedException) {
                            call.reject("INTERRUPTED", e.getMessage(), e);
                        } else if (e instanceof GetCredentialUnknownException) {
                            call.reject("UNKNOWN_ERROR", e.getMessage(), e);
                        } else {
                            call.reject("FAILED", e.getMessage(), e);
                        }
                    }
                }
            );
        } catch (Exception ex) {
            call.reject("EXCEPTION", ex.getMessage(), ex);
        }
    }
}
