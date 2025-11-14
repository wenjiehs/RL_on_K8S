/*
Copyright 2025.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUTHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// RLTrainingJobSpec defines the desired state of RLTrainingJob
type RLTrainingJobSpec struct {
	// EnvironmentRef is the name of the RLEnvironment to use for this training job.
	// +kubebuilder:validation:Required
	EnvironmentRef string `json:"environmentRef"`

	// Framework defines the distributed training framework to use (e.g., Ray, Horovod).
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:Enum=Ray;Horovod;DeepSpeed
	Framework string `json:"framework"`

	// OfflineDataPath is the path to offline training data in COS.
	// +kubebuilder:validation:Optional
	OfflineDataPath string `json:"offlineDataPath,omitempty"`

	// RealtimeDataTopic is the Kafka topic for real-time training data.
	// +kubebuilder:validation:Optional
	RealtimeDataTopic string `json:"realtimeDataTopic,omitempty"`

	// CheckpointSpec defines the checkpoint configuration.
	// +kubebuilder:validation:Optional
	CheckpointSpec *CheckpointSpec `json:"checkpointSpec,omitempty"`

	// AlertingSpec defines the alerting configuration.
	// +kubebuilder:validation:Optional
	AlertingSpec *AlertingSpec `json:"alertingSpec,omitempty"`
}

// AlertingSpec defines the alerting configuration.
type AlertingSpec struct {
	// WebhookSpec defines the webhook configuration for alerts.
	// +kubebuilder:validation:Optional
	Webhook *WebhookSpec `json:"webhook,omitempty"`
}

// WebhookSpec defines the webhook configuration.
type WebhookSpec struct {
	// URL is the webhook URL to send alerts to.
	// +kubebuilder:validation:Required
	URL string `json:"url"`
}

// CheckpointSpec defines the checkpoint configuration.
type CheckpointSpec struct {
	// Path is the COS path to store checkpoints.
	Path string `json:"path"`
	// IntervalSeconds is the interval in seconds to save checkpoints.
	IntervalSeconds int32 `json:"intervalSeconds"`
}

// RLTrainingJobStatus defines the observed state of RLTrainingJob
type RLTrainingJobStatus struct {
	// Status is the current status of the training job (e.g., Pending, Running, Succeeded, Failed).
	Status string `json:"status,omitempty"`

	// StartTime is the time the job was started.
	StartTime *metav1.Time `json:"startTime,omitempty"`

	// CompletionTime is the time the job was completed.
	CompletionTime *metav1.Time `json:"completionTime,omitempty"`

	// LastCheckpointTime is the time the last checkpoint was saved.
	LastCheckpointTime *metav1.Time `json:"lastCheckpointTime,omitempty"`

	// Conditions represent the latest available observations of an object's state.
	Conditions []metav1.Condition `json:"conditions,omitempty"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status

// RLTrainingJob is the Schema for the rltrainingjobs API
type RLTrainingJob struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   RLTrainingJobSpec   `json:"spec,omitempty"`
	Status RLTrainingJobStatus `json:"status,omitempty"`
}

//+kubebuilder:object:root=true

// RLTrainingJobList contains a list of RLTrainingJob
type RLTrainingJobList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []RLTrainingJob `json:"items"`
}

func init() {
	SchemeBuilder.Register(&RLTrainingJob{}, &RLTrainingJobList{})
}